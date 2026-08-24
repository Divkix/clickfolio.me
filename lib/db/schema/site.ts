import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { ResumeContent } from "../../types/database";
import { user } from "./auth";
import { resumes } from "./resume";

/**
 * Site data table — stores a user's portfolio / public site content.
 * Each user has exactly one siteData row (userId is unique). Deleting the user's resume
 * cascades to siteData because of the onDelete: "cascade" on resumeId, which effectively
 * deletes the user's entire site data when their resume is removed.
 */
export const siteData = pgTable(
  "site_data",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    /**
     * FK to the active resume. CRITICAL: onDelete: "cascade" means deleting a resume
     * cascades to siteData. Since userId is unique, this effectively wipes the user's
     * entire site data when their resume is deleted.
     */
    resumeId: text("resume_id").references(() => resumes.id, {
      onDelete: "cascade",
    }),
    /** Portfolio content as JSONB. Drizzle serializes on write and parses on read. */
    content: jsonb("content").$type<ResumeContent>().notNull(),
    /** Portfolio theme identifier. Defaults to "minimalist_editorial". */
    themeId: text("theme_id").default("minimalist_editorial"),
    lastPublishedAt: timestamp("last_published_at", {
      withTimezone: true,
      mode: "string",
    }), // Nullable - represents "never published"
    // Preview columns for directory/listing pages (denormalized for performance)
    previewName: text("preview_name"),
    previewHeadline: text("preview_headline"),
    previewLocation: text("preview_location"),
    /** Number of experience entries shown in directory preview. */
    previewExpCount: integer("preview_exp_count"),
    /** Number of education entries shown in directory preview. */
    previewEduCount: integer("preview_edu_count"),
    /** JSON array of the first 4 skills for directory preview. Drizzle parses/serializes automatically. */
    previewSkills: jsonb("preview_skills").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("site_data_resume_id_idx").on(table.resumeId),
    index("site_data_updated_at_idx").on(table.updatedAt),
  ],
);

/** Row type inferred from the site_data table (select). */
export type SiteData = typeof siteData.$inferSelect;
/** Insert type inferred from the site_data table. */
export type NewSiteData = typeof siteData.$inferInsert;
