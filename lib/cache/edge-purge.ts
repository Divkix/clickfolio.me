import * as z from "zod";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";

/**
 * Queued Workers Cache purges.
 *
 * Workers Cache purges always run at Free-tier limits: 5 purge requests a
 * minute per account, a burst bucket of 25, and at most 100 tags per request
 * (https://developers.cloudflare.com/workers/cache/purge/,
 * https://developers.cloudflare.com/cache/how-to/purge-cache/). Profile edits
 * therefore enqueue their tags and one consumer sends one purge per batch.
 *
 * Tags travel already encoded (`vinext-<32 hex>`, the digest vinext's Workers
 * Cache adapter emits in `Cache-Tag`), so no handle reaches the queue or logs.
 */

export const MAX_TAGS_PER_PURGE = 100;

/** Must match `max_retries` on the consumer in wrangler.jsonc. */
export const EDGE_PURGE_MAX_RETRIES = 8;

/**
 * With `max_concurrency: 1`, holding each invocation open this long after its
 * purge keeps the consumer at or under 5 purges a minute.
 */
export const MIN_PURGE_INTERVAL_MS = 12_000;

const FIRST_RETRY_DELAY_SECONDS = 30;

const MAX_RETRY_DELAY_SECONDS = 900;

const ENCODED_TAG = /^vinext-[0-9a-f]{32}$/;

const edgePurgeMessageSchema = z.object({
  tags: z.array(z.string().regex(ENCODED_TAG)).min(1).max(MAX_TAGS_PER_PURGE),
});

export type EdgePurgeMessage = z.infer<typeof edgePurgeMessageSchema>;

/** What `ctx.cache.purge()` resolves to; parsed because it crosses an RPC boundary. */
export const purgeResultSchema = z.object({
  success: z.boolean(),
  errors: z
    .array(z.object({ code: z.number().optional(), message: z.string().optional() }))
    .default([]),
});

export type PurgeResult = z.infer<typeof purgeResultSchema>;

/** Purges tags from the cache-bearing entrypoint; `undefined` when it has no cache. */
export type PurgeTags = (tags: string[]) => Promise<PurgeResult | undefined>;

type Wait = (ms: number) => Promise<void>;

const wait: Wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 30s, 60s, 120s … capped at 15 min, so retries outlast a drained burst bucket. */
export function retryDelaySeconds(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);

  return Math.min(FIRST_RETRY_DELAY_SECONDS * 2 ** exponent, MAX_RETRY_DELAY_SECONDS);
}

/**
 * Enqueue a purge of encoded tags. Never throws: a purge must not fail the
 * write that triggered it. The short page TTL bounds staleness if this fails.
 */
export async function enqueueEdgePurge(
  queue: Queue<EdgePurgeMessage> | undefined,
  tags: string[],
): Promise<void> {
  const unique = [...new Set(tags)];

  if (unique.length === 0) return;

  if (!queue) {
    log("error", "edge purge queue binding missing", { tags: unique, tag_count: unique.length });

    return;
  }

  const messages: Array<MessageSendRequest<EdgePurgeMessage>> = [];

  for (let start = 0; start < unique.length; start += MAX_TAGS_PER_PURGE) {
    messages.push({
      body: { tags: unique.slice(start, start + MAX_TAGS_PER_PURGE) },
      contentType: "json",
    });
  }

  try {
    await queue.sendBatch(messages);
  } catch (error) {
    log("error", "edge purge enqueue failed", {
      tags: unique,
      tag_count: unique.length,
      ...errorFields(error),
    });
  }
}

/** How one batch splits: the messages one purge covers, and their deduplicated tags. */
type PurgePlan = {
  included: Message[];
  overflow: Message[];
  malformed: Message[];
  tags: string[];
};

function planPurge(messages: readonly Message[]): PurgePlan {
  const tags = new Set<string>();
  const plan: PurgePlan = { included: [], overflow: [], malformed: [], tags: [] };

  for (const message of messages) {
    const parsed = edgePurgeMessageSchema.safeParse(message.body);

    if (!parsed.success) {
      plan.malformed.push(message);
      continue;
    }

    const fresh = new Set(parsed.data.tags.filter((tag) => !tags.has(tag)));

    if (tags.size + fresh.size > MAX_TAGS_PER_PURGE) {
      plan.overflow.push(message);
      continue;
    }

    for (const tag of fresh) tags.add(tag);
    plan.included.push(message);
  }

  plan.tags = [...tags];

  return plan;
}

function describeFailure(result: PurgeResult): string {
  return (
    result.errors
      .map(({ code, message }) => [code, message].filter(Boolean).join(": "))
      .join(", ") || "unknown"
  );
}

/**
 * Retry with a growing delay. Every retry counts toward `max_retries`, after
 * which the queue moves the message to the dead-letter queue; log that here,
 * since the queue itself does not.
 */
function retryWithBackoff(messages: readonly Message[], tags: string[]): void {
  for (const message of messages) {
    if (message.attempts > EDGE_PURGE_MAX_RETRIES) {
      log("error", "edge purge dead-lettered", {
        messageId: message.id,
        attempts: message.attempts,
        tags,
        tag_count: tags.length,
      });
    }

    message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
  }
}

/**
 * Queue consumer: one deduplicated purge per batch. Messages whose tags would
 * push the purge past 100 tags go back on the queue for the next batch (a
 * retry, so it counts toward `max_retries`; `max_batch_size` keeps a batch
 * well under 100 tags). A failed or rate-limited purge retries its messages
 * with a growing delay until the queue dead-letters them.
 */
export async function processEdgePurgeBatch(
  batch: MessageBatch,
  purge: PurgeTags,
  pause: Wait = wait,
): Promise<void> {
  const { included, overflow, malformed, tags } = planPurge(batch.messages);

  for (const message of malformed) {
    // A malformed body can never succeed, so retrying it would only reach the DLQ later.
    log("error", "dropping malformed edge purge message", { messageId: message.id });
    message.ack();
  }

  for (const message of overflow) {
    if (message.attempts > EDGE_PURGE_MAX_RETRIES) {
      log("error", "edge purge dead-lettered", { messageId: message.id, reason: "overflow" });
    }

    message.retry({ delaySeconds: 0 });
  }

  if (tags.length === 0) return;

  const startedAt = Date.now();
  let failure: string | undefined;

  try {
    const result = await purge(tags);

    if (!result) failure = "Workers Cache unavailable on the cached entrypoint";
    else if (!result.success) failure = describeFailure(result);
  } catch (error) {
    failure = errorFields(error)["error.message"];
  }

  if (failure === undefined) {
    for (const message of included) message.ack();
    log("info", "edge purge completed", {
      tags,
      tag_count: tags.length,
      message_count: included.length,
      duration_ms: Date.now() - startedAt,
    });
  } else {
    log("error", "edge purge failed", {
      tags,
      tag_count: tags.length,
      message_count: included.length,
      messageIds: included.map(({ id }) => id),
      max_attempts: Math.max(...included.map(({ attempts }) => attempts)),
      reason: failure,
    });
    retryWithBackoff(included, tags);
  }

  // A failed purge still spends rate budget, so pace either way.
  const remaining = MIN_PURGE_INTERVAL_MS - (Date.now() - startedAt);

  if (remaining > 0) await pause(remaining);
}
