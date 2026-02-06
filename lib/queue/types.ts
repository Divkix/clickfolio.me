/**
 * Queue message types for Cloudflare Queues
 */

import { z } from "zod";

/**
 * Zod schema for resume parse queue messages.
 * Used at system boundaries (worker.ts queue consumer) to validate untrusted input.
 *
 * Currently a single-variant discriminated union.
 * Add more message types here when needed — z.discriminatedUnion("type", [...]).
 */
export const queueMessageSchema = z.object({
  type: z.literal("parse"),
  resumeId: z.string().min(1),
  userId: z.string().min(1),
  r2Key: z.string().min(1),
  fileHash: z.string().min(1),
  attempt: z.number().int().positive(),
});

/**
 * Message for resume parsing queue
 */
export type ResumeParseMessage = z.infer<typeof queueMessageSchema>;

/**
 * Union type for all queue messages
 */
export type QueueMessage = z.infer<typeof queueMessageSchema>;

/**
 * Dead letter queue message wrapper
 */
export interface DeadLetterMessage {
  originalMessage: QueueMessage;
  failureReason: string;
  failedAt: string;
  attempts: number;
}
