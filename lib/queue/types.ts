/**
 * Queue message types for Cloudflare Queues
 */

/**
 * Message for resume parsing queue
 */
export interface ResumeParseMessage {
  type: "parse";
  resumeId: string;
  userId: string;
  r2Key: string;
  fileHash: string;
  attempt: number;
}

/**
 * Message for cache invalidation queue
 */
export interface CacheInvalidationMessage {
  type: "invalidate";
  handles: string[];
  paths: string[];
}

/**
 * Message for notification queue
 */
export interface NotificationMessage {
  type: "email";
  template: "account-deleted" | "parse-complete";
  to: string;
  data: Record<string, unknown>;
}

/**
 * Union type for all queue messages
 */
export type QueueMessage = ResumeParseMessage | CacheInvalidationMessage | NotificationMessage;

/**
 * Dead letter queue message wrapper
 */
export interface DeadLetterMessage {
  originalMessage: QueueMessage;
  failureReason: string;
  failedAt: string;
  attempts: number;
}
