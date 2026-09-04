import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const pendingR2Deletions = pgTable(
  "pending_r2_deletions",
  {
    id: text("id").primaryKey(),
    r2Key: text("r2_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
  },
  (table) => [index("pending_r2_deletions_created_at_idx").on(table.createdAt)],
);

export type PendingR2Deletion = typeof pendingR2Deletions.$inferSelect;
export type NewPendingR2Deletion = typeof pendingR2Deletions.$inferInsert;
