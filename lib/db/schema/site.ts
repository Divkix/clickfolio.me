import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { resumes } from "./resume";

/**
 * Site data table — stores a user's portfolio / public site content.
 * Each user has exactly one siteData row (userId is unique). Deleting the user's resume
 * cascades to siteData because of the onDelete: "cascade" on resumeId, which effectively
 * deletes the user's entire site data when their resume is removed.
 */
export const siteData = sqliteTable(
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
		/** Portfolio content as JSON-in-TEXT. Must be JSON.parse'd on read and JSON.stringify'd on write. */
		content: text("content").notNull(),
		/** Portfolio theme identifier. Defaults to "minimalist_editorial". */
		themeId: text("theme_id").default("minimalist_editorial"),
		lastPublishedAt: text("last_published_at"), // Nullable - represents "never published"
		// Preview columns for directory/listing pages (denormalized for performance)
		previewName: text("preview_name"),
		previewHeadline: text("preview_headline"),
		previewLocation: text("preview_location"),
		/** Number of experience entries shown in directory preview. */
		previewExpCount: integer("preview_exp_count"),
		/** Number of education entries shown in directory preview. */
		previewEduCount: integer("preview_edu_count"),
		/** JSON array of the first 4 skills for directory preview. */
		previewSkills: text("preview_skills"), // JSON array of first 4 skills
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
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
