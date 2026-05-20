import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// =============================================================================
// Better Auth Core Tables
// =============================================================================

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
    handle: text("handle").unique(),
    headline: text("headline"),
    privacySettings: text("privacy_settings")
      .notNull()
      .default(
        '{"show_phone":false,"show_address":false,"hide_from_search":false,"show_in_directory":true}',
      ),
    onboardingCompleted: integer("onboarding_completed", { mode: "boolean" })
      .notNull()
      .default(false),
    role: text("role", {
      enum: ["student", "entry_level", "mid_level", "senior", "executive"],
    }),
    roleSource: text("role_source", { enum: ["ai", "user"] }),
    // Referral tracking: stores user ID of referrer
    referredBy: text("referred_by"),
    // When the referral was credited (set when referredBy is first written)
    referredAt: text("referred_at"),
    // Pro flag: unlocks all themes
    isPro: integer("is_pro", { mode: "boolean" }).notNull().default(false),
    // Denormalized count of users referred by this user
    referralCount: integer("referral_count").notNull().default(0),
    // Permanent referral code (generated once at signup, never changes)
    referralCode: text("referral_code").unique(),
    // Admin flag for admin dashboard access
    isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
    // Denormalized from privacySettings JSON for indexed directory queries
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
    password: text("password"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    // Index for auth lookups by userId
    index("account_user_id_idx").on(table.userId),
  ],
);

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

export type UserRole = "student" | "entry_level" | "mid_level" | "senior" | "executive";

export type UserRoleSource = "ai" | "user";

export interface PrivacySettings {
  show_phone: boolean;
  show_address: boolean;
  hide_from_search: boolean;
  show_in_directory: boolean;
}
