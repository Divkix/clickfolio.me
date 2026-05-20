import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { resumes } from "./resume";

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
    // Preview columns for directory/listing pages (denormalized for performance)
    previewName: text("preview_name"),
    previewHeadline: text("preview_headline"),
    previewLocation: text("preview_location"),
    previewExpCount: integer("preview_exp_count"),
    previewEduCount: integer("preview_edu_count"),
    previewSkills: text("preview_skills"), // JSON array of first 4 skills
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("site_data_resume_id_idx").on(table.resumeId),
    index("site_data_updated_at_idx").on(table.updatedAt),
  ],
);

export type SiteData = typeof siteData.$inferSelect;
export type NewSiteData = typeof siteData.$inferInsert;
