import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/**
 * Resumes table — stores uploaded resume files and their AI-parsed content.
 * Parsing is queue-backed: a file is uploaded, then processed asynchronously via the Clickfolio parse queue.
 *
 * Status lifecycle:
 *   pending_claim → queued → processing → completed | failed | waiting_for_cache
 *
 * Column distinctions:
 *   - parsedContent: the final validated JSON result after successful parsing
 *   - parsedContentStaged: raw AI output before validation (temporary, cleared on success)
 *   - errorMessage: terminal error that caused the resume to fail permanently
 *   - lastAttemptError: error from the most recent parse attempt (may be cleared on retry)
 *   - retryCount: number of retries attempted so far (resets on each retry cycle)
 *   - totalAttempts: cumulative count of all parse attempts across all retries
 *   - updatedAt: nullable — set on updates but may be null for newly created rows
 */
export const resumes = sqliteTable(
	"resumes",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		/** R2 object key where the uploaded resume PDF is stored. */
		r2Key: text("r2_key").notNull(),
		/**
		 * Parse status. Lifecycle:
		 *   pending_claim → queued → processing → completed | failed | waiting_for_cache
		 */
		status: text("status", {
			enum: [
				"pending_claim",
				"queued",
				"processing",
				"completed",
				"failed",
				"waiting_for_cache",
			],
		})
			.notNull()
			.default("pending_claim"),
		/** Terminal error message when parsing reaches the failed state. */
		errorMessage: text("error_message"),
		parsedAt: text("parsed_at"),
		/** Number of retry attempts in the current retry cycle. Resets on each retry. */
		retryCount: integer("retry_count").notNull().default(0),
		/** SHA-256 hash of the uploaded file for deduplication. */
		fileHash: text("file_hash"),
		/** Final validated parsed resume content as JSON-in-TEXT. */
		parsedContent: text("parsed_content"),
		// Queue idempotency fields
		queuedAt: text("queued_at"),
		/** Raw AI-parsed output before validation. Cleared once parsing succeeds. */
		parsedContentStaged: text("parsed_content_staged"),
		/** Error from the most recent parse attempt. May be cleared on retry. */
		lastAttemptError: text("last_attempt_error"),
		/** Cumulative number of parse attempts across all retries. */
		totalAttempts: integer("total_attempts").notNull().default(0),
		createdAt: text("created_at").notNull(),
		/** Nullable — updated timestamp. May be null for newly created rows. */
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

/** Row type inferred from the resumes table (select). */
export type Resume = typeof resumes.$inferSelect;
/** Insert type inferred from the resumes table. */
export type NewResume = typeof resumes.$inferInsert;

/** Possible states in the resume parsing lifecycle. */
export type ResumeStatus =
	| "pending_claim"
	| "queued"
	| "processing"
	| "completed"
	| "failed"
	| "waiting_for_cache";
