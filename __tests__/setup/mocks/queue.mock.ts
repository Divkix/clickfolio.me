/**
 * Cloudflare Queues mock factories.
 *
 * Provides stubs for `MessageBatch<T>`, queue messages, and DLQ message
 * wrappers used by the resume-parse-queue consumer in `worker/index.ts`.
 */

import { vi } from "vitest";
import type { DeadLetterMessage, ResumeParseMessage } from "@/lib/queue/types";

// ---------------------------------------------------------------------------
// Queue message factory
// ---------------------------------------------------------------------------

interface CreateQueueMessageOverrides {
  resumeId?: string;
  userId?: string;
  r2Key?: string;
  fileHash?: string;
  attempt?: number;
}

/**
 * Create a mock `ResumeParseMessage` matching the queue schema.
 */
export function createMockQueueMessage(
  overrides: CreateQueueMessageOverrides = {},
): ResumeParseMessage {
  return {
    type: "parse",
    resumeId: overrides.resumeId ?? "resume-queue-uuid-001",
    userId: overrides.userId ?? "user-queue-uuid-001",
    r2Key: overrides.r2Key ?? "uploads/test/resume.pdf",
    fileHash: overrides.fileHash ?? "sha256-filehash-abc123",
    attempt: overrides.attempt ?? 1,
  };
}

// ---------------------------------------------------------------------------
// Dead letter message factory
// ---------------------------------------------------------------------------

interface CreateDeadLetterOverrides {
  originalMessage?: ResumeParseMessage;
  failureReason?: string;
  failedAt?: string;
  attempts?: number;
}

export function createMockDeadLetterMessage(
  overrides: CreateDeadLetterOverrides = {},
): DeadLetterMessage {
  return {
    originalMessage: overrides.originalMessage ?? createMockQueueMessage(),
    failureReason: overrides.failureReason ?? "AI provider timeout",
    failedAt: overrides.failedAt ?? "2026-01-15T12:05:00.000Z",
    attempts: overrides.attempts ?? 3,
  };
}

// ---------------------------------------------------------------------------
// MessageBatch mock
// ---------------------------------------------------------------------------

/**
 * Creates a mock `MessageBatch<T>` as Cloudflare Workers delivers it to
 * the queue handler.
 *
 * ```ts
 * const batch = createMockMessageBatch(createMockQueueMessage());
 * await queueHandler(batch, env, ctx);
 * expect(batch.ackAll).toHaveBeenCalled();
 * ```
 */
export function createMockMessageBatch<T = ResumeParseMessage>(messages: T[] = []) {
  const queueMessages: Array<{
    id: string;
    timestamp: Date;
    body: T;
    retryCount: number;
  }> = messages.map((msg, i) => ({
    id: `msg-${String(i).padStart(3, "0")}`,
    timestamp: new Date("2026-01-15T12:00:00.000Z"),
    body: msg,
    retryCount: 0,
  }));

  return {
    messages: queueMessages,
    ackAll: vi.fn().mockResolvedValue(undefined),
    retryAll: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// ExecutionContext mock
// ---------------------------------------------------------------------------

/**
 * Creates a mock `ExecutionContext` (used in Workers fetch/queue handlers).
 */
export function createMockExecutionContext() {
  const waitUntilPromises: Promise<unknown>[] = [];
  return {
    waitUntil: vi.fn().mockImplementation((promise: Promise<unknown>) => {
      waitUntilPromises.push(promise);
    }),
    passThroughOnException: vi.fn(),
    get waitUntilPromises() {
      return waitUntilPromises;
    },
  };
}

// ---------------------------------------------------------------------------
// ScheduledEvent mock (for cron handlers)
// ---------------------------------------------------------------------------

export function createMockScheduledEvent(overrides: { cron?: string } = {}) {
  return {
    scheduledTime: new Date("2026-01-15T00:00:00.000Z"),
    cron: overrides.cron ?? "0 */30 * * *",
    type: "scheduled" as const,
    noRetry: vi.fn(),
  };
}
