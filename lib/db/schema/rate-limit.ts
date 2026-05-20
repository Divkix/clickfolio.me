import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const handleChanges = sqliteTable(
  "handle_changes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    oldHandle: text("old_handle"),
    newHandle: text("new_handle").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("handle_changes_user_id_idx").on(table.userId),
    index("handle_changes_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const uploadRateLimits = sqliteTable(
  "upload_rate_limits",
  {
    id: text("id").primaryKey(),
    ipHash: text("ip_hash").notNull(),
    actionType: text("action_type", { enum: ["upload", "handle_check", "email_validate"] })
      .notNull()
      .default("upload"),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(), // TTL: createdAt + 24h for automatic cleanup
  },
  (table) => [
    // Redundant standalone (ipHash) index removed — (ipHash, createdAt) and
    // (ipHash, actionType, createdAt) both satisfy prefix lookups on ipHash alone.
    index("upload_rate_limits_ip_created_idx").on(table.ipHash, table.createdAt),
    index("upload_rate_limits_expires_idx").on(table.expiresAt), // Index for cleanup queries
    index("upload_rate_limits_ip_action_idx").on(table.ipHash, table.actionType, table.createdAt),
  ],
);

export const referralClicks = sqliteTable(
  "referral_clicks",
  {
    id: text("id").primaryKey(),
    referrerUserId: text("referrer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    visitorHash: text("visitor_hash").notNull(),
    source: text("source", { enum: ["homepage", "cta", "share"] }),
    converted: integer("converted", { mode: "boolean" }).notNull().default(false),
    convertedUserId: text("converted_user_id").references(() => user.id, { onDelete: "set null" }),
    convertedAt: text("converted_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("referral_clicks_referrer_idx").on(table.referrerUserId),
    index("referral_clicks_visitor_idx").on(table.visitorHash),
    index("referral_clicks_referrer_created_idx").on(table.referrerUserId, table.createdAt),
    // Enforce idempotent click tracking (1 click per referrer+visitorHash)
    uniqueIndex("referral_clicks_dedup_idx").on(table.referrerUserId, table.visitorHash),
    // Composite index for queries filtering by referrer + conversion status
    index("referral_clicks_referrer_converted_idx").on(table.referrerUserId, table.converted),
  ],
);

export type HandleChange = typeof handleChanges.$inferSelect;
export type NewHandleChange = typeof handleChanges.$inferInsert;

export type UploadRateLimit = typeof uploadRateLimits.$inferSelect;
export type NewUploadRateLimit = typeof uploadRateLimits.$inferInsert;

export type ReferralClick = typeof referralClicks.$inferSelect;
export type NewReferralClick = typeof referralClicks.$inferInsert;
