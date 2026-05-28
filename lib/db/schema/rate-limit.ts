import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

// =============================================================================
// Rate-limiting and referral tracking tables
// =============================================================================

/**
 * Handle changes table — tracks handle rename history for rate-limiting.
 * Users are limited to 3 handle changes per 24 hours.
 * oldHandle is nullable because the first handle assignment has no previous value.
 */
export const handleChanges = sqliteTable(
	"handle_changes",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		/** Previous handle. Nullable because the first handle set has no prior value. */
		oldHandle: text("old_handle"),
		newHandle: text("new_handle").notNull(),
		createdAt: text("created_at").notNull(),
	},
	(table) => [
		index("handle_changes_user_id_idx").on(table.userId),
		index("handle_changes_user_created_idx").on(table.userId, table.createdAt),
	],
);

/**
 * Upload rate limits table — tracks per-IP actions for rate limiting.
 * actionType enum: "upload" (resume upload), "handle_check" (handle availability check), "email_validate" (email validation).
 */
export const uploadRateLimits = sqliteTable(
	"upload_rate_limits",
	{
		id: text("id").primaryKey(),
		ipHash: text("ip_hash").notNull(),
		/** Action being rate-limited. Values: "upload", "handle_check", "email_validate". */
		actionType: text("action_type", {
			enum: ["upload", "handle_check", "email_validate"],
		})
			.notNull()
			.default("upload"),
		createdAt: text("created_at").notNull(),
		expiresAt: text("expires_at").notNull(), // TTL: createdAt + 24h for automatic cleanup
	},
	(table) => [
		// Redundant standalone (ipHash) index removed — (ipHash, createdAt) and
		// (ipHash, actionType, createdAt) both satisfy prefix lookups on ipHash alone.
		index("upload_rate_limits_ip_created_idx").on(
			table.ipHash,
			table.createdAt,
		),
		index("upload_rate_limits_expires_idx").on(table.expiresAt), // Index for cleanup queries
		index("upload_rate_limits_ip_action_idx").on(
			table.ipHash,
			table.actionType,
			table.createdAt,
		),
	],
);

/**
 * Referral clicks table — tracks referral link visits and conversions.
 * source enum: "homepage" (landing page), "cta" (call-to-action button), "share" (direct share link).
 * visitorHash is a fingerprint hash of the visitor to deduplicate clicks.
 * converted is set to true when the visitor signs up and is linked to a user.
 */
export const referralClicks = sqliteTable(
	"referral_clicks",
	{
		id: text("id").primaryKey(),
		referrerUserId: text("referrer_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		/** Fingerprint hash of the visitor to deduplicate clicks per referrer. */
		visitorHash: text("visitor_hash").notNull(),
		/** Referral source. Values: "homepage" (landing page), "cta" (button), "share" (direct link). */
		source: text("source", { enum: ["homepage", "cta", "share"] }),
		/** Whether the click resulted in a signup. */
		converted: integer("converted", { mode: "boolean" })
			.notNull()
			.default(false),
		convertedUserId: text("converted_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		/** ISO timestamp when the referral was converted (signup completed). */
		convertedAt: text("converted_at"),
		createdAt: text("created_at").notNull(),
	},
	(table) => [
		index("referral_clicks_referrer_idx").on(table.referrerUserId),
		index("referral_clicks_visitor_idx").on(table.visitorHash),
		index("referral_clicks_referrer_created_idx").on(
			table.referrerUserId,
			table.createdAt,
		),
		// Enforce idempotent click tracking (1 click per referrer+visitorHash)
		uniqueIndex("referral_clicks_dedup_idx").on(
			table.referrerUserId,
			table.visitorHash,
		),
		// Composite index for queries filtering by referrer + conversion status
		index("referral_clicks_referrer_converted_idx").on(
			table.referrerUserId,
			table.converted,
		),
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

/** Row type inferred from the referral_clicks table (select). */
export type ReferralClick = typeof referralClicks.$inferSelect;
/** Insert type inferred from the referral_clicks table. */
export type NewReferralClick = typeof referralClicks.$inferInsert;
