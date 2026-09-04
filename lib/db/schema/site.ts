import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { ResumeContent } from "../../types/database";
import { user } from "./auth";
import { resumes } from "./resume";

export const siteData = pgTable(
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
    content: jsonb("content").$type<ResumeContent>().notNull(),
    themeId: text("theme_id").default("minimalist_editorial"),
    lastPublishedAt: timestamp("last_published_at", {
      withTimezone: true,
      mode: "string",
    }),
    previewName: text("preview_name"),
    previewHeadline: text("preview_headline"),
    previewLocation: text("preview_location"),
    previewExpCount: integer("preview_exp_count"),
    previewEduCount: integer("preview_edu_count"),
    previewSkills: jsonb("preview_skills").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("site_data_resume_id_idx").on(table.resumeId),
    index("site_data_updated_at_idx").on(table.updatedAt),
  ],
);

export type SiteData = typeof siteData.$inferSelect;
export type NewSiteData = typeof siteData.$inferInsert;
