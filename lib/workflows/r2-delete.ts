import { R2 } from "../r2";
import { log } from "../utils/log";

// Trigger side of R2DeleteWorkflow. Kept apart from the class so routes can
// hand off deletions without importing `cloudflare:workers`.

export type R2DeleteParams = {
  keys: string[];
  /** Also delete every object under this prefix (listed inside the workflow). */
  prefix?: string;
};

export type R2DeleteWorkflowBinding = Workflow<R2DeleteParams>;

/** Hands the keys to R2DeleteWorkflow, which retries each batch with backoff. Throws if it cannot start. */
export async function scheduleR2Deletion(
  workflow: R2DeleteWorkflowBinding | undefined,
  params: R2DeleteParams,
): Promise<void> {
  if (!workflow) {
    throw new Error("CLICKFOLIO_R2_DELETE_WORKFLOW binding not available");
  }

  await workflow.create({ params });
}

/**
 * Deletes inline and hands any failed key to R2DeleteWorkflow.
 * Returns the keys that failed inline (they are retried in the background).
 */
export async function deleteR2Objects(
  bucket: R2Bucket,
  workflow: R2DeleteWorkflowBinding | undefined,
  keys: string[],
): Promise<string[]> {
  const results = await Promise.allSettled(keys.map((key) => R2.delete(bucket, key)));
  const failedKeys = keys.filter((_, index) => results[index].status === "rejected");

  if (failedKeys.length === 0) return failedKeys;

  log("warn", "R2 delete failed; retrying in R2DeleteWorkflow", { keys: failedKeys });

  try {
    await scheduleR2Deletion(workflow, { keys: failedKeys });
  } catch (error) {
    log("error", "failed to schedule R2 deletion", { keys: failedKeys, error: String(error) });
  }

  return failedKeys;
}
