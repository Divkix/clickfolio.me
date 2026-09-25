import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { R2DeleteParams } from "./r2-delete";

// R2 `delete()` accepts up to 1000 keys per call and is a no-op for missing keys,
// so a replayed batch is harmless.
const DELETE_BATCH_SIZE = 1000;

const R2_STEP = {
  retries: { limit: 8, delay: "1 minute", backoff: "exponential" },
  timeout: "5 minutes",
} as const;

async function listPrefix(bucket: R2Bucket, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await bucket.list({ prefix, limit: DELETE_BATCH_SIZE, cursor });

    for (const object of page.objects) keys.push(object.key);
    // SAFETY: R2 listResult with truncated true guarantees cursor presence per R2 API contract; cast narrows to paginated type for next page.
    cursor = page.truncated ? (page as R2Objects & { truncated: true }).cursor : undefined;
  } while (cursor);

  return keys;
}

/** Durable R2 deletion with per-batch retries. Replaces the `pending_r2_deletions` table and its sweep. */
export class R2DeleteWorkflow extends WorkflowEntrypoint<CloudflareEnv, R2DeleteParams> {
  async run(event: WorkflowEvent<R2DeleteParams>, step: WorkflowStep): Promise<number> {
    const { keys, prefix } = event.payload;
    const bucket = this.env.CLICKFOLIO_R2_BUCKET;

    const listed = prefix
      ? await step.do(`list ${prefix}`, R2_STEP, () => listPrefix(bucket, prefix))
      : [];

    const allKeys = [...new Set([...keys, ...listed])];

    for (let start = 0; start < allKeys.length; start += DELETE_BATCH_SIZE) {
      const batch = allKeys.slice(start, start + DELETE_BATCH_SIZE);
      await step.do(`delete batch ${start}`, R2_STEP, async () => {
        await bucket.delete(batch);
      });
    }

    return allKeys.length;
  }
}
