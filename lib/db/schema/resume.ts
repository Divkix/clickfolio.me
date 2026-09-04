import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { ResumeContent } from "../../types/database";
import type { JsonValue } from "../../types/json";
import { user } from "./auth";

export const resumes = pgTable(
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
    parsedAt: timestamp("parsed_at", { withTimezone: true, mode: "string" }),
    retryCount: integer("retry_count").notNull().default(0),
    fileHash: text("file_hash"),
    parsedContent: jsonb("parsed_content").$type<ResumeContent>(),
    queuedAt: timestamp("queued_at", { withTimezone: true, mode: "string" }),
    parsedContentStaged: jsonb("parsed_content_staged").$type<JsonValue>(),
    lastAttemptError: text("last_attempt_error"),
    totalAttempts: integer("total_attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("resumes_file_hash_status_idx").on(table.fileHash, table.status),
    index("resumes_user_id_created_at_idx").on(table.userId, table.createdAt),
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
