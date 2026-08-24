import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// =============================================================================
// User table
// =============================================================================
//
// Type-mapping decisions (match the live PlanetScale Postgres schema):
//   - Primary keys stay `text`: legacy ids are nanoid-style strings and Clerk
//     ids are user_* strings — NOT UUIDs. New users may reuse their Clerk id as
//     both `id` and `clerkId`; imported users keep the legacy id plus clerkId.
//   - Timestamps are timestamptz with mode: "string" so app-level values stay
//     ISO strings, matching what the D1 era stored.
//   - JSON columns are jsonb: Drizzle serializes on write and parses on read —
//     callers must NOT wrap these in JSON.parse/JSON.stringify.
//   - Enum-like text stays text + TS union type (no native PG enums).

/**
 * User table — stores Clickfolio profile data plus the Clerk identity mapping.
 * Each row represents one registered user with their profile and settings.
 */
export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified"),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
    // Profile fields
    /**
     * Clerk user id. Imported users resolve by this column; new signups may use
     * the Clerk id as both `id` and `clerkId`. UNIQUE keeps the join 1:1-safe.
     */
    clerkId: text("clerk_id").unique(),
    /** Unique public handle used in portfolio URLs (e.g., /@handle). */
    handle: text("handle").unique(),
    /** One-line professional headline displayed on the portfolio. */
    headline: text("headline"),
    /**
     * Privacy settings as JSONB. Parsed/stringified by Drizzle automatically.
     * Controls phone, address, search, and directory visibility.
     */
    // MUST equal DEFAULT_PRIVACY_SETTINGS_JSON in lib/utils/privacy.ts — kept as
    // a literal here to avoid a circular import (schema → utils → schema for types).
    privacySettings: jsonb("privacy_settings").$type<PrivacySettings>().notNull().default({
      show_phone: false,
      show_address: false,
      hide_from_search: false,
      show_in_directory: true,
    }),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    /** Career level inferred by AI or set by the user. */
    role: text("role", {
      enum: ["student", "entry_level", "mid_level", "senior", "executive"],
    }),
    /** Source of the role value — "ai" if inferred during resume parsing, "user" if manually set. */
    roleSource: text("role_source", { enum: ["ai", "user"] }),
    /** Admin flag — grants access to the admin dashboard. */
    isAdmin: boolean("is_admin").notNull().default(false),
    /**
     * Denormalized from privacySettings JSON for indexed directory queries.
     * WARNING: This can drift from the JSON value if privacySettings is updated
     * without syncing this column. Always update both together.
     */
    showInDirectory: boolean("show_in_directory").notNull().default(true),
  },
  (table) => [
    // Note: clerkId already has an implicit unique index from its .unique() constraint
    // Index for /explore directory queries (WHERE show_in_directory = TRUE)
    index("user_show_in_directory_idx").on(table.showInDirectory),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

/** Career level classification for a user. */
export type UserRole = "student" | "entry_level" | "mid_level" | "senior" | "executive";

/** Source indicating whether the role was AI-inferred or manually set by the user. */
export type UserRoleSource = "ai" | "user";

/**
 * Privacy settings stored as JSONB in the user table.
 * Drizzle serializes on write and parses on read — no manual JSON.parse needed.
 * The "show_in_directory" field is denormalized to the user.showInDirectory column for indexing.
 */
export interface PrivacySettings {
  show_phone: boolean;
  show_address: boolean;
  hide_from_search: boolean;
  show_in_directory: boolean;
}
