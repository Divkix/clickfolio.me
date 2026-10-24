import { Context, Effect, Layer } from "effect";
import {
  startResumeParse,
  type ResumeParseParams,
  type ResumeParseWorkflowBinding,
} from "@/lib/workflows/resume-parse";
import { externalCall } from "../external";
import { WorkflowFailed } from "../failures";
import { TIMEOUT_MS } from "../timeouts";

type ParseWorkflowLike = Pick<ResumeParseWorkflowBinding, "create" | "get">;

type WorkflowStarterService = {
  /**
   * Starts a ResumeParseWorkflow run under `id`, which is the idempotency key: a create that
   * errored after the instance was persisted is not a failure. Never retried here. A `timeout`
   * failure means the outcome is unknown (the instance may exist); callers that give up on the
   * run rely on the pipeline's steps being status-guarded, so a late start finds nothing to do.
   */
  readonly startResumeParse: (
    id: string,
    params: ResumeParseParams,
  ) => Effect.Effect<void, WorkflowFailed>;
};

const OPERATION = "workflow.create.resume_parse";

function service(workflow: ParseWorkflowLike | undefined): WorkflowStarterService {
  return {
    startResumeParse: (id, params) => {
      if (!workflow) {
        return Effect.fail(
          new WorkflowFailed({
            operation: OPERATION,
            kind: "unavailable",
            message: "CLICKFOLIO_PARSE_WORKFLOW binding not available",
          }),
        );
      }

      return externalCall({
        operation: OPERATION,
        timeoutMs: TIMEOUT_MS.workflow,
        // startResumeParse owns the create-or-get idempotency and the workflow.create span.
        run: () => startResumeParse(workflow, id, params),
        fail: (details) => new WorkflowFailed(details),
        span: false,
      });
    },
  };
}

/** Starts parse runs. Provide it at the edge, never from module scope. */
export class WorkflowStarter extends Context.Service<WorkflowStarter, WorkflowStarterService>()(
  "clickfolio/WorkflowStarter",
) {
  /** A missing binding makes every start fail `unavailable`. */
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
