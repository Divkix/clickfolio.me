import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Pending R2 deletions table — tracks R2 file keys that could not be deleted
 * during account deletion and need to be retried by the cleanup cron.
 *
 * Rows are inserted when an R2 delete fails inside the account-deletion flow
 * (GDPR "delete my data"). The 2 AM cron sweeps this table and retries each
 * deletion. On success the row is removed; on repeated failure the attempts
 * counter is incremented so the issue surfaces for manual review.
 *
 * There is intentionally no FK to the user table — the user row will have been
 * deleted by the time the cron runs.
 */
export const pendingR2Deletions = sqliteTable(
  "pending_r2_deletions",
  {
    id: text("id").primaryKey(),
    r2Key: text("r2_key").notNull(),
    createdAt: text("created_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
  },
  (table) => [index("pending_r2_deletions_created_at_idx").on(table.createdAt)],
);

/** Row type inferred from the pending_r2_deletions table (select). */
export type PendingR2Deletion = typeof pendingR2Deletions.$inferSelect;
/** Insert type inferred from the pending_r2_deletions table. */
export type NewPendingR2Deletion = typeof pendingR2Deletions.$inferInsert;
