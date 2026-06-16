import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// =============================================================================
// Better Auth Core Tables
// =============================================================================

/**
 * User table — stores both Better Auth core fields and Clickfolio custom profile data.
 * Each row represents one registered user with their auth credentials, profile, and settings.
 */
export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }),
    image: text("image"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    // Custom fields
    /** Unique public handle used in portfolio URLs (e.g., /@handle). */
    handle: text("handle").unique(),
    /** One-line professional headline displayed on the portfolio. */
    headline: text("headline"),
    /** JSON-in-TEXT privacy settings. Parsed/stringified at runtime. Controls phone, address, search, and directory visibility. */
    // MUST equal DEFAULT_PRIVACY_SETTINGS_JSON in lib/utils/privacy.ts — kept as
    // a literal here to avoid a circular import (schema → utils → schema for types).
    privacySettings: text("privacy_settings")
      .notNull()
      .default(
        '{"show_phone":false,"show_address":false,"hide_from_search":false,"show_in_directory":true}',
      ),
    onboardingCompleted: integer("onboarding_completed", { mode: "boolean" })
      .notNull()
      .default(false),
    /** Career level inferred by AI or set by the user. */
    role: text("role", {
      enum: ["student", "entry_level", "mid_level", "senior", "executive"],
    }),
    /** Source of the role value — "ai" if inferred during resume parsing, "user" if manually set. */
    roleSource: text("role_source", { enum: ["ai", "user"] }),
    /** User ID of the referrer who invited this user (referral tracking). */
    referredBy: text("referred_by"),
    /** ISO timestamp when the referral was credited (set once when referredBy is first written). */
    referredAt: text("referred_at"),
    /** Pro subscription flag — unlocks all portfolio themes. */
    isPro: integer("is_pro", { mode: "boolean" }).notNull().default(false),
    /**
     * Denormalized count of users successfully referred by this user.
     * Maintained by SQLite triggers (see migrations/0026_referral_count_triggers.sql).
     * IMPORTANT: triggers are NOT tracked by Drizzle snapshots and are dropped
     * whenever the `user` table is rebuilt (the pattern drizzle-kit emits for
     * column changes). After ANY migration that rebuilds `user`, re-append the
     * idempotent triggers migration so referral_count keeps updating.
     */
    referralCount: integer("referral_count").notNull().default(0),
    /** Permanent referral code generated once at signup and never changed. */
    referralCode: text("referral_code").unique(),
    /** Admin flag — grants access to the admin dashboard. */
    isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
    /**
     * Denormalized from privacySettings JSON for indexed directory queries.
     * WARNING: This can drift from the JSON value if privacySettings is updated
     * without syncing this column. Always update both together.
     */
    showInDirectory: integer("show_in_directory", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    // Index for referral count queries and atomic updates on referredBy
    index("user_referred_by_idx").on(table.referredBy),
    // Note: referralCode already has implicit unique index from .unique() constraint
    // Index for /explore directory queries (WHERE show_in_directory = 1)
    index("user_show_in_directory_idx").on(table.showInDirectory),
  ],
);

/**
 * Session table — active login sessions for authenticated users.
 * Each row is one session token tied to a user with expiration metadata.
 */
export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    // Index for auth lookups by userId
    index("session_user_id_idx").on(table.userId),
    // Index for session cleanup queries
    index("session_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * Account table — OAuth provider accounts linked to a user.
 * Each row stores tokens and metadata for one provider account (e.g., Google).
 */
export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: text("access_token_expires_at"),
    refreshTokenExpiresAt: text("refresh_token_expires_at"),
    scope: text("scope"),
    idToken: text("id_token"),
    /** Password hash — exists for Better Auth compatibility (future email/password support). Currently unused. */
    password: text("password"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    // Index for auth lookups by userId
    index("account_user_id_idx").on(table.userId),
    // Composite unique index for provider accounts
    uniqueIndex("account_provider_account_id_idx").on(table.providerId, table.accountId),
  ],
);

/**
 * Verification table — short-lived OTP / email verification tokens.
 * Used by Better Auth for email verification and password reset flows.
 */
export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    // Index for verification lookups
    index("verification_identifier_idx").on(table.identifier),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;

/** Career level classification for a user. */
export type UserRole = "student" | "entry_level" | "mid_level" | "senior" | "executive";

/** Source indicating whether the role was AI-inferred or manually set by the user. */
export type UserRoleSource = "ai" | "user";

/**
 * Privacy settings stored as JSON-in-TEXT in the user table.
 * Must be JSON.parse'd on read and JSON.stringify'd on write.
 * The "show_in_directory" field is denormalized to the user.showInDirectory column for indexing.
 */
export interface PrivacySettings {
  show_phone: boolean;
  show_address: boolean;
  hide_from_search: boolean;
  show_in_directory: boolean;
}
