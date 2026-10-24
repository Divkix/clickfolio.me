import { Context, Effect, Layer } from "effect";
import { withSpan } from "@/lib/telemetry/spans";
import {
  PARSE_WORKFLOW_NAME,
  parseRunAttributes,
  resumeParseParamsSchema,
  type ResumeParseParams,
} from "@/lib/workflows/resume-parse-params";
import { log } from "@/lib/utils/log";
import { externalCall } from "../external";
import { upstreamLogFields } from "../failure-fields";
import { InvalidInput, WorkflowFailed } from "../failures";
import { TIMEOUT_MS } from "../timeouts";

/** The slice of the ResumeParseWorkflow binding this service uses; tests pass a fake. */
type ParseWorkflowLike = {
  create(options: { id: string; params: ResumeParseParams }): Promise<{ id: string }>;
  get(id: string): Promise<{ id: string }>;
};

type WorkflowStarterService = {
  /**
   * Starts a ResumeParseWorkflow run under `id`. The id is the idempotency key, so a create that
   * failed or timed out after the instance was persisted is not an error: the instance is looked
   * up before giving up. Params are checked first; never retried here.
   */
  readonly startResumeParse: (
    id: string,
    params: ResumeParseParams,
  ) => Effect.Effect<void, WorkflowFailed | InvalidInput>;
};

const CREATE = "workflow.resume_parse.create";

const LOOKUP = "workflow.resume_parse.get";

function service(workflow: ParseWorkflowLike | undefined): WorkflowStarterService {
  return {
    startResumeParse: (id, params) => {
      const parsed = resumeParseParamsSchema.safeParse(params);

      if (!parsed.success) {
        return Effect.fail(new InvalidInput({ message: "Invalid resume parse request" }));
      }

      if (!workflow) {
        return Effect.fail(
          new WorkflowFailed({
            operation: CREATE,
            kind: "unavailable",
            message: "CLICKFOLIO_PARSE_WORKFLOW binding not available",
          }),
        );
      }

      // The runtime exposes no trace context to pass on, so the run's step spans repeat these ids.
      const attributes = {
        ...parseRunAttributes(id, parsed.data.resumeId),
        "workflow.params.kind": parsed.data.kind,
      };

      return externalCall({
        operation: CREATE,
        timeoutMs: TIMEOUT_MS.workflow,
        run: () =>
          withSpan(`workflow.create ${PARSE_WORKFLOW_NAME}`, attributes, () =>
            workflow.create({ id, params: parsed.data }),
          ),
        fail: (details) => new WorkflowFailed(details),
        span: false,
      }).pipe(
        Effect.asVoid,
        Effect.catchTag("WorkflowFailed", (created) =>
          externalCall({
            operation: LOOKUP,
            timeoutMs: TIMEOUT_MS.workflow,
            run: () => workflow.get(id),
            fail: (details) => new WorkflowFailed(details),
          }).pipe(
            Effect.asVoid,
            // Not found is the common answer here; the create failure is what the caller needs.
            Effect.catchTag("WorkflowFailed", (lookup) =>
              Effect.sync(() =>
                log("warn", "resume parse instance not found after create failed", {
                  ...upstreamLogFields(lookup),
                }),
              ).pipe(Effect.andThen(Effect.fail(created))),
            ),
          ),
        ),
      );
    },
  };
}

/** Starts Workflows runs. Provide it at the edge, never from module scope. */
export class WorkflowStarter extends Context.Service<WorkflowStarter, WorkflowStarterService>()(
  "clickfolio/WorkflowStarter",
) {
  static layer(
    env: Partial<Pick<CloudflareEnv, "CLICKFOLIO_PARSE_WORKFLOW">>,
  ): Layer.Layer<WorkflowStarter> {
    return Layer.sync(WorkflowStarter, () => service(env.CLICKFOLIO_PARSE_WORKFLOW));
  }

  /** For tests: any object with `create` and `get`. */
  static layerFrom(workflow: ParseWorkflowLike | undefined): Layer.Layer<WorkflowStarter> {
    return Layer.succeed(WorkflowStarter, service(workflow));
  }
}
