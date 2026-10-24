import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { Effect } from "effect";
import { R2_DELETE_BATCH_LIMIT, R2Store } from "../effect/services/r2-store";
import { log } from "../utils/log";
import { r2DeleteParamsSchema, type R2DeleteParams } from "./r2-delete-params";
import { runWorkflowStep } from "./run-workflow-step";

// R2 `delete()` accepts up to 1000 keys per call and is a no-op for missing keys, so a
// replayed batch is harmless. That is also why a step may be retried after an R2 timeout:
// the delete that timed out can only have removed objects that were meant to go.
const R2_STEP = {
  retries: { limit: 8, delay: "1 minute", backoff: "exponential" },
  timeout: "5 minutes",
} as const;

/** Durable R2 deletion with per-batch retries. Replaces the `pending_r2_deletions` table and its sweep. */
export class R2DeleteWorkflow extends WorkflowEntrypoint<CloudflareEnv, R2DeleteParams> {
  async run(event: WorkflowEvent<R2DeleteParams>, step: WorkflowStep): Promise<number> {
    // Same schema as scheduling: an unsafe prefix would sweep far more than one account.
    const params = r2DeleteParamsSchema.safeParse(event.payload);

    if (!params.success) {
      log("error", "R2 delete workflow refused invalid params", {
        issueCount: params.error.issues.length,
      });

      throw new NonRetryableError("Invalid R2 delete params");
    }

    const { keys, prefix } = params.data;
    const layer = R2Store.layer(this.env);

    const listed = prefix
      ? await step.do(`list ${prefix}`, R2_STEP, () =>
          runWorkflowStep(
            Effect.provide(
              R2Store.use((store) => store.listKeys(prefix)),
              layer,
            ),
          ),
        )
      : [];

    const allKeys = [...new Set([...keys, ...listed])];

    // One step per batch, because a batch is the journaled and retried unit; `deleteMany` deletes
    // exactly the keys it is given.
    for (let start = 0; start < allKeys.length; start += R2_DELETE_BATCH_LIMIT) {
      const batch = allKeys.slice(start, start + R2_DELETE_BATCH_LIMIT);

      await step.do(`delete batch ${start}`, R2_STEP, () =>
        runWorkflowStep(
          Effect.provide(
            R2Store.use((store) => store.deleteMany(batch)),
            layer,
          ),
        ),
      );
    }

    return allKeys.length;
  }
}
