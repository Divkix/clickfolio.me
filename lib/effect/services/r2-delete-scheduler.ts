import { Context, Effect, Layer } from "effect";
import { r2DeleteParamsSchema, type R2DeleteParams } from "@/lib/workflows/r2-delete-params";
import { externalCall } from "../external";
import { InvalidInput, WorkflowFailed } from "../failures";
import { TIMEOUT_MS } from "../timeouts";

type R2DeleteWorkflowLike = {
  create(options: { params: R2DeleteParams }): Promise<{ id: string }>;
};

type R2DeleteSchedulerService = {
  /**
   * Starts R2DeleteWorkflow, which retries each batch with backoff. The params are checked
   * first: an unsafe prefix or an empty key never reaches the workflow. Never retried here;
   * a duplicate instance only repeats idempotent deletes, but a timeout still surfaces.
   */
  readonly schedule: (params: R2DeleteParams) => Effect.Effect<void, WorkflowFailed | InvalidInput>;
};

const OPERATION = "workflow.r2_delete.create";

function service(workflow: R2DeleteWorkflowLike | undefined): R2DeleteSchedulerService {
  return {
    schedule: (params) => {
      const parsed = r2DeleteParamsSchema.safeParse(params);

      // The issues name keys and prefixes, which carry user ids and file names: say nothing of them.
      if (!parsed.success) {
        return Effect.fail(new InvalidInput({ message: "Invalid R2 deletion request" }));
      }

      if (!workflow) {
        return Effect.fail(
          new WorkflowFailed({
            operation: OPERATION,
            kind: "unavailable",
            message: "CLICKFOLIO_R2_DELETE_WORKFLOW binding not available",
          }),
        );
      }

      return externalCall({
        operation: OPERATION,
        timeoutMs: TIMEOUT_MS.workflow,
        run: () => workflow.create({ params: parsed.data }),
        fail: (details) => new WorkflowFailed(details),
      }).pipe(Effect.asVoid);
    },
  };
}

/** Hands R2 deletions to R2DeleteWorkflow. Provide it at the edge, never from module scope. */
export class R2DeleteScheduler extends Context.Service<
  R2DeleteScheduler,
  R2DeleteSchedulerService
>()("clickfolio/R2DeleteScheduler") {
  static layer(
    env: Partial<Pick<CloudflareEnv, "CLICKFOLIO_R2_DELETE_WORKFLOW">>,
  ): Layer.Layer<R2DeleteScheduler> {
    return Layer.sync(R2DeleteScheduler, () => service(env.CLICKFOLIO_R2_DELETE_WORKFLOW));
  }

  /** For tests: any object with a `create` method. */
  static layerFrom(workflow: R2DeleteWorkflowLike | undefined): Layer.Layer<R2DeleteScheduler> {
    return Layer.succeed(R2DeleteScheduler, service(workflow));
  }
}
