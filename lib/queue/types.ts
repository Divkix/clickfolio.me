import { z } from "zod";

export const queueMessageSchema = z.object({
  type: z.literal("parse"),
  resumeId: z.string().min(1),
  userId: z.string().min(1),
  r2Key: z.string().min(1),
  fileHash: z.string().min(1),
  attempt: z.number().int().positive(),
});

export type ResumeParseMessage = z.infer<typeof queueMessageSchema>;

export type QueueMessage = ResumeParseMessage;

export interface DeadLetterMessage {
  originalMessage: QueueMessage;
  failureReason: string;
  failedAt: string;
  attempts: number;
}
