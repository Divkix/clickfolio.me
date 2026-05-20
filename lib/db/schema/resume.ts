import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const resumes = sqliteTable(
  "resumes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    status: text("status", {
      enum: ["pending_claim", "queued", "processing", "completed", "failed", "waiting_for_cache"],
    })
      .notNull()
      .default("pending_claim"),
    errorMessage: text("error_message"),
    parsedAt: text("parsed_at"),
    retryCount: integer("retry_count").notNull().default(0),
    fileHash: text("file_hash"),
    parsedContent: text("parsed_content"),
    // Queue idempotency fields
    queuedAt: text("queued_at"),
    parsedContentStaged: text("parsed_content_staged"),
    lastAttemptError: text("last_attempt_error"),
    totalAttempts: integer("total_attempts").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"),
  },
  (table) => [
    index("resumes_user_id_idx").on(table.userId),
    index("resumes_file_hash_idx").on(table.fileHash),
    index("resumes_file_hash_status_idx").on(table.fileHash, table.status),
    index("resumes_user_id_created_at_idx").on(table.userId, table.createdAt),
    index("resumes_status_idx").on(table.status),
    index("resumes_status_queued_at_idx").on(table.status, table.queuedAt),
  ],
);

export type Resume = typeof resumes.$inferSelect;
export type NewResume = typeof resumes.$inferInsert;

export type ResumeStatus =
  | "pending_claim"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "waiting_for_cache";
