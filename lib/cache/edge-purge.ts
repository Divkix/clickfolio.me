import { Cause, Effect, Exit, type Layer } from "effect";
import * as z from "zod";
import { runBackground } from "@/lib/effect/edges";
import { describeFailure } from "@/lib/effect/failure-map";
import { type HttpUpstreamFailed, InvalidInput, type QueueFailed } from "@/lib/effect/failures";
import { CachePurge, type PurgeResult } from "@/lib/effect/services/cache-purge";
import { EdgePurgeQueue } from "@/lib/effect/services/edge-purge-queue";
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

/** The RPC behind `CachePurge`; `undefined` when the entrypoint has no cache. */
export type PurgeTags = (tags: string[]) => Promise<PurgeResult | undefined>;

type Wait = (ms: number) => Promise<void>;

const wait: Wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 30s, 60s, 120s … capped at 15 min, so retries outlast a drained burst bucket. */
export function retryDelaySeconds(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);

  return Math.min(FIRST_RETRY_DELAY_SECONDS * 2 ** exponent, MAX_RETRY_DELAY_SECONDS);
}

/** Producer-side message check: a tag the consumer would drop as malformed never gets sent. */
function validatedMessages(
  tags: string[],
): Effect.Effect<Array<MessageSendRequest<EdgePurgeMessage>>, InvalidInput> {
  const messages: Array<MessageSendRequest<EdgePurgeMessage>> = [];

  for (let start = 0; start < tags.length; start += MAX_TAGS_PER_PURGE) {
    const parsed = edgePurgeMessageSchema.safeParse({
      tags: tags.slice(start, start + MAX_TAGS_PER_PURGE),
    });

    if (!parsed.success) {
      return Effect.fail(new InvalidInput({ message: "edge purge tags are not encoded digests" }));
    }

    messages.push({ body: parsed.data, contentType: "json" });
  }

  return Effect.succeed(messages);
}

/** Queues the purge messages for already-deduplicated tags. */
function sendPurgeMessages(
  tags: string[],
): Effect.Effect<void, InvalidInput | QueueFailed, EdgePurgeQueue> {
  return validatedMessages(tags).pipe(
    Effect.flatMap((messages) => EdgePurgeQueue.use((queue) => queue.sendBatch(messages))),
  );
}

/**
 * Enqueue a purge of encoded tags as an Effect, for callers that already run inside one (a
 * Workflow step). Fails with the typed error so the caller decides how to log it; a timed-out
 * send is not retried, it may have landed.
 */
export function purgeEdgeTags(
  tags: readonly string[],
): Effect.Effect<void, InvalidInput | QueueFailed, EdgePurgeQueue> {
  const unique = [...new Set(tags)];

  return unique.length === 0 ? Effect.void : sendPurgeMessages(unique);
}

/**
 * Enqueue a purge of encoded tags. Never throws: a purge must not fail the write that triggered
 * it, and the short page TTL bounds staleness if this fails. Every failure is logged with the
 * tags (digests, not handles). A timed-out send is not retried: it may have landed.
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

  const exit = await runBackground(
    sendPurgeMessages(unique).pipe(
      Effect.catchTags({
        InvalidInput: (failure) =>
          Effect.sync(() => {
            log("error", "edge purge enqueue failed", {
              tags: unique,
              tag_count: unique.length,
              ...errorFields(failure),
            });
          }),
        QueueFailed: (failure) =>
          Effect.sync(() => {
            log("error", "edge purge enqueue failed", {
              tags: unique,
              tag_count: unique.length,
              operation: failure.operation,
              kind: failure.kind,
              ...errorFields(failure.cause ?? failure),
            });
          }),
      }),
    ),
    EdgePurgeQueue.layer(queue),
  );

  if (Exit.isFailure(exit)) {
    log("error", "edge purge enqueue failed", {
      tags: unique,
      tag_count: unique.length,
      ...errorFields(Cause.squash(exit.cause)),
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

/** What the consumer does next: nothing to settle on success, else the typed failure to judge. */
type PurgeOutcome = { readonly failure: HttpUpstreamFailed | undefined };

function purgeTags(tags: string[]): Effect.Effect<PurgeOutcome, never, CachePurge> {
  return CachePurge.use((cache) => cache.purge(tags)).pipe(
    Effect.match({
      onSuccess: (): PurgeOutcome => ({ failure: undefined }),
      onFailure: (failure): PurgeOutcome => ({ failure }),
    }),
  );
}

/**
 * Queue consumer: one deduplicated purge per batch. Messages whose tags would
 * push the purge past 100 tags go back on the queue for the next batch (a
 * retry, so it counts toward `max_retries`; `max_batch_size` keeps a batch
 * well under 100 tags).
 *
 * A failed purge is settled by the typed failure's `retryable` flag: a timeout,
 * an outage or a rate limit retries its messages with a growing delay until the
 * queue dead-letters them; a response that can never succeed (rejected, or not
 * the documented shape) is acked and logged, because retrying it would only
 * delay the same outcome. Staleness is bounded by the page TTL.
 */
export async function processEdgePurgeBatch(
  batch: MessageBatch,
  purge: Layer.Layer<CachePurge>,
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
  const exit = await runBackground(purgeTags(tags), purge);

  const failureFields = {
    tags,
    tag_count: tags.length,
    message_count: included.length,
    messageIds: included.map(({ id }) => id),
    max_attempts: Math.max(...included.map(({ attempts }) => attempts)),
  };

  if (Exit.isFailure(exit)) {
    // A defect (a bug, never a typed failure): the purge's outcome is unknown, so try again.
    log("error", "edge purge failed", {
      ...failureFields,
      reason: errorFields(Cause.squash(exit.cause))["error.message"],
    });
    retryWithBackoff(included, tags);
  } else if (exit.value.failure === undefined) {
    for (const message of included) message.ack();
    log("info", "edge purge completed", {
      tags,
      tag_count: tags.length,
      message_count: included.length,
      duration_ms: Date.now() - startedAt,
    });
  } else {
    const { failure } = exit.value;
    const { retryable } = describeFailure(failure);

    log("error", "edge purge failed", {
      ...failureFields,
      reason: failure.message,
      kind: failure.kind,
      retryable,
    });

    if (retryable) {
      retryWithBackoff(included, tags);
    } else {
      for (const message of included) message.ack();
    }
  }

  // A failed purge still spends rate budget, so pace either way.
  const remaining = MIN_PURGE_INTERVAL_MS - (Date.now() - startedAt);

  if (remaining > 0) await pause(remaining);
}
