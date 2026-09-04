import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const handleChanges = pgTable(
  "handle_changes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    oldHandle: text("old_handle"),
    newHandle: text("new_handle").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [index("handle_changes_user_created_idx").on(table.userId, table.createdAt)],
);

export const uploadRateLimits = pgTable(
  "upload_rate_limits",
  {
    id: text("id").primaryKey(),
    ipHash: text("ip_hash").notNull(),
    actionType: text("action_type", {
      enum: ["upload", "handle_check"],
    })
      .notNull()
      .default("upload"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    index("upload_rate_limits_ip_created_idx").on(table.ipHash, table.createdAt),
    index("upload_rate_limits_expires_idx").on(table.expiresAt),
    index("upload_rate_limits_ip_action_idx").on(table.ipHash, table.actionType, table.createdAt),
  ],
);

export type HandleChange = typeof handleChanges.$inferSelect;
export type NewHandleChange = typeof handleChanges.$inferInsert;

export type UploadRateLimit = typeof uploadRateLimits.$inferSelect;
export type NewUploadRateLimit = typeof uploadRateLimits.$inferInsert;
