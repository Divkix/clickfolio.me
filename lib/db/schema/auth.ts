import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
    clerkId: text("clerk_id").unique(),
    handle: text("handle").unique(),
    headline: text("headline"),
    privacySettings: jsonb("privacy_settings").$type<PrivacySettings>().notNull().default({
      show_phone: false,
      show_address: false,
      hide_from_search: false,
      show_in_directory: true,
    }),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    role: text("role", {
      enum: ["student", "entry_level", "mid_level", "senior", "executive"],
    }),
    roleSource: text("role_source", { enum: ["ai", "user"] }),
    isAdmin: boolean("is_admin").notNull().default(false),
    showInDirectory: boolean("show_in_directory").notNull().default(true),
  },
  (table) => [index("user_show_in_directory_idx").on(table.showInDirectory)],
);

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type UserRole = "student" | "entry_level" | "mid_level" | "senior" | "executive";

export type UserRoleSource = "ai" | "user";

export interface PrivacySettings {
  show_phone: boolean;
  show_address: boolean;
  hide_from_search: boolean;
  show_in_directory: boolean;
}
