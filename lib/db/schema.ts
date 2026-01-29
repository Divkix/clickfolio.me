import { relations } from "drizzle-orm";
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
      .default('{"show_phone":false,"show_address":false,"hide_from_search":false}'),
    onboardingCompleted: integer("onboarding_completed", { mode: "boolean" })
      .notNull()
      .default(false),
    role: text("role", {
      enum: [
        "student",
        "recent_graduate",
        "junior_professional",
        "mid_level_professional",
        "senior_professional",
        "freelancer",
      ],
    }),
    // Referral tracking: stores user ID of referrer
    referredBy: text("referred_by"),
  },
  (table) => [
    // Index for sitemap queries (WHERE handle IS NOT NULL ORDER BY handle)
    index("user_handle_idx").on(table.handle),
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
// Application Tables
// =============================================================================

export const resumes = sqliteTable(
  "resumes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    status: text("status", {
      enum: ["pending_claim", "queued", "processing", "completed", "failed", "waiting_for_cache"],
    })
      .notNull()
      .default("pending_claim"),
    errorMessage: text("error_message"),
    parsedAt: text("parsed_at"),
    retryCount: integer("retry_count").notNull().default(0),
    fileHash: text("file_hash"),
    parsedContent: text("parsed_content"),
    // Queue idempotency fields
    queuedAt: text("queued_at"),
    parsedContentStaged: text("parsed_content_staged"),
    lastAttemptError: text("last_attempt_error"),
    totalAttempts: integer("total_attempts").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"),
  },
  (table) => [
    index("resumes_user_id_idx").on(table.userId),
    index("resumes_file_hash_idx").on(table.fileHash),
    index("resumes_file_hash_status_idx").on(table.fileHash, table.status),
    index("resumes_user_id_created_at_idx").on(table.userId, table.createdAt),
    index("resumes_status_idx").on(table.status),
    index("resumes_status_queued_at_idx").on(table.status, table.queuedAt),
  ],
);

export const siteData = sqliteTable(
  "site_data",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    resumeId: text("resume_id").references(() => resumes.id, {
      onDelete: "cascade",
    }),
    content: text("content").notNull(),
    themeId: text("theme_id").default("minimalist_editorial"),
    lastPublishedAt: text("last_published_at"), // Nullable - represents "never published"
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("site_data_resume_id_idx").on(table.resumeId)],
);

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

export const pageViews = sqliteTable(
  "page_views",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    visitorHash: text("visitor_hash").notNull(),
    referrer: text("referrer"),
    country: text("country"),
    deviceType: text("device_type", {
      enum: ["mobile", "tablet", "desktop"],
    }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("page_views_user_created_idx").on(table.userId, table.createdAt),
    index("page_views_dedup_idx").on(table.visitorHash, table.userId, table.createdAt),
    index("page_views_created_idx").on(table.createdAt),
  ],
);

export const uploadRateLimits = sqliteTable(
  "upload_rate_limits",
  {
    id: text("id").primaryKey(),
    ipHash: text("ip_hash").notNull(),
    actionType: text("action_type", { enum: ["upload", "handle_check"] })
      .notNull()
      .default("upload"),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(), // TTL: createdAt + 24h for automatic cleanup
  },
  (table) => [
    index("upload_rate_limits_ip_hash_idx").on(table.ipHash),
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
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("referral_clicks_referrer_idx").on(table.referrerUserId),
    index("referral_clicks_visitor_idx").on(table.visitorHash),
    index("referral_clicks_referrer_created_idx").on(table.referrerUserId, table.createdAt),
    index("referral_clicks_dedup_idx").on(table.referrerUserId, table.visitorHash),
  ],
);

// =============================================================================
// Relations
// =============================================================================

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  resumes: many(resumes),
  siteData: one(siteData, {
    fields: [user.id],
    references: [siteData.userId],
  }),
  handleChanges: many(handleChanges),
  pageViews: many(pageViews),
  referralClicks: many(referralClicks),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const resumesRelations = relations(resumes, ({ one }) => ({
  user: one(user, {
    fields: [resumes.userId],
    references: [user.id],
  }),
  siteData: one(siteData),
}));

export const siteDataRelations = relations(siteData, ({ one }) => ({
  user: one(user, {
    fields: [siteData.userId],
    references: [user.id],
  }),
  resume: one(resumes, {
    fields: [siteData.resumeId],
    references: [resumes.id],
  }),
}));

export const handleChangesRelations = relations(handleChanges, ({ one }) => ({
  user: one(user, {
    fields: [handleChanges.userId],
    references: [user.id],
  }),
}));

export const pageViewsRelations = relations(pageViews, ({ one }) => ({
  user: one(user, {
    fields: [pageViews.userId],
    references: [user.id],
  }),
}));

export const referralClicksRelations = relations(referralClicks, ({ one }) => ({
  referrer: one(user, {
    fields: [referralClicks.referrerUserId],
    references: [user.id],
  }),
  convertedUser: one(user, {
    fields: [referralClicks.convertedUserId],
    references: [user.id],
  }),
}));

// =============================================================================
// Type Exports
// =============================================================================

// User types
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

// Session types
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

// Account types
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

// Verification types
export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;

// Resume types
export type Resume = typeof resumes.$inferSelect;
export type NewResume = typeof resumes.$inferInsert;

// SiteData types
export type SiteData = typeof siteData.$inferSelect;
export type NewSiteData = typeof siteData.$inferInsert;

// HandleChanges types
export type HandleChange = typeof handleChanges.$inferSelect;
export type NewHandleChange = typeof handleChanges.$inferInsert;

// PageViews types
export type PageView = typeof pageViews.$inferSelect;
export type NewPageView = typeof pageViews.$inferInsert;

// UploadRateLimits types
export type UploadRateLimit = typeof uploadRateLimits.$inferSelect;
export type NewUploadRateLimit = typeof uploadRateLimits.$inferInsert;

// ReferralClicks types
export type ReferralClick = typeof referralClicks.$inferSelect;
export type NewReferralClick = typeof referralClicks.$inferInsert;

// Privacy settings helper type
export type PrivacySettings = {
  show_phone: boolean;
  show_address: boolean;
  hide_from_search: boolean;
};

// Resume status enum type
export type ResumeStatus =
  | "pending_claim"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "waiting_for_cache";

// User role enum type
export type UserRole =
  | "student"
  | "recent_graduate"
  | "junior_professional"
  | "mid_level_professional"
  | "senior_professional"
  | "freelancer";
