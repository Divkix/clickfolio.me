import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

// =============================================================================
// Rate-limiting tables
// =============================================================================

/**
 * Handle changes table — tracks handle rename history for rate-limiting.
 * Users are limited to 3 handle changes per 24 hours.
 * oldHandle is nullable because the first handle assignment has no previous value.
 */
export const handleChanges = pgTable(
  "handle_changes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Previous handle. Nullable because the first handle set has no prior value. */
    oldHandle: text("old_handle"),
    newHandle: text("new_handle").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [index("handle_changes_user_created_idx").on(table.userId, table.createdAt)],
);

/**
 * Upload rate limits table — tracks per-IP actions for rate limiting.
 * actionType enum: "upload" (resume upload), "handle_check" (handle availability check).
 */
export const uploadRateLimits = pgTable(
  "upload_rate_limits",
  {
    id: text("id").primaryKey(),
    ipHash: text("ip_hash").notNull(),
    /** Action being rate-limited. Values: "upload", "handle_check". */
    actionType: text("action_type", {
      enum: ["upload", "handle_check"],
    })
      .notNull()
      .default("upload"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(), // TTL: createdAt + 24h for automatic cleanup
  },
  (table) => [
    // Redundant standalone (ipHash) index removed — (ipHash, createdAt) and
    // (ipHash, actionType, createdAt) both satisfy prefix lookups on ipHash alone.
    index("upload_rate_limits_ip_created_idx").on(table.ipHash, table.createdAt),
    index("upload_rate_limits_expires_idx").on(table.expiresAt), // Index for cleanup queries
    index("upload_rate_limits_ip_action_idx").on(table.ipHash, table.actionType, table.createdAt),
  ],
);

/** Row type inferred from the handle_changes table (select). */
export type HandleChange = typeof handleChanges.$inferSelect;
/** Insert type inferred from the handle_changes table. */
export type NewHandleChange = typeof handleChanges.$inferInsert;

/** Row type inferred from the upload_rate_limits table (select). */
export type UploadRateLimit = typeof uploadRateLimits.$inferSelect;
/** Insert type inferred from the upload_rate_limits table. */
export type NewUploadRateLimit = typeof uploadRateLimits.$inferInsert;
