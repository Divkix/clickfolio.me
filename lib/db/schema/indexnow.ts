import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Survives user deletion: removed and renamed URLs must still reach search engines. */
export const indexNowUrls = pgTable(
  "indexnow_urls",
  {
    url: text("url").primaryKey(),
    revision: integer("revision").notNull().default(1),
    pending: boolean("pending").notNull().default(true),
    urgent: boolean("urgent").notNull().default(false),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "string" }).notNull(),
    lastSubmittedAt: timestamp("last_submitted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [index("indexnow_urls_pending_due_idx").on(table.pending, table.dueAt)],
);

/** One durable sender lease and upstream cooldown shared by every Worker colo and deploy. */
export const indexNowState = pgTable("indexnow_state", {
  id: text("id").primaryKey(),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: "string" }).notNull(),
  leaseId: text("lease_id"),
  leaseUntil: timestamp("lease_until", { withTimezone: true, mode: "string" }),
  failures: integer("failures").notNull().default(0),
});
