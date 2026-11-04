// Trigger settings deployed by alchemy.run.ts and assumed by the Worker code. No imports: the
// stack loads this file in Node.

/** Cron triggers; `scheduled()` in worker/index.ts routes each one. */
export const CRONS = ["* * * * *", "0 3 * * *", "*/15 * * * *"];

/**
 * Workers Cache purges for edge-cached pages (lib/cache/edge-purge.ts). Purges run at Free-tier
 * limits (5/min per account, 100 tags each), so one consumer (maxConcurrency 1, held open 12s per
 * batch) sends one deduplicated purge per batch.
 * https://developers.cloudflare.com/workers/cache/purge/
 * https://developers.cloudflare.com/queues/configuration/batching-retries/
 */
export const EDGE_PURGE_CONSUMER = {
  batchSize: 30,
  maxWaitTimeMs: 10_000,
  maxConcurrency: 1,
  maxRetries: 8,
  retryDelay: 30,
};
