import { relations } from "drizzle-orm";
import { user } from "./auth";
import { handleChanges } from "./rate-limit";
import { resumes } from "./resume";
import { siteData } from "./site";

// =============================================================================
// Relations
// =============================================================================

/**
 * User relations — one user has many resumes and handle changes, and exactly
 * one siteData row.
 */
export const userRelations = relations(user, ({ many, one }) => ({
  resumes: many(resumes),
  siteData: one(siteData, {
    fields: [user.id],
    references: [siteData.userId],
  }),
  handleChanges: many(handleChanges),
}));

/**
 * Resume relations — each resume belongs to exactly one user.
 * The implicit siteData relation omits fields/references because Drizzle can infer
 * the one-to-one link from the unique userId on siteData.
 */
export const resumesRelations = relations(resumes, ({ one }) => ({
  user: one(user, {
    fields: [resumes.userId],
    references: [user.id],
  }),
  siteData: one(siteData),
}));

/** Site data relations — each siteData row belongs to one user and optionally one resume. */
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

/** Handle changes relation — each change record belongs to exactly one user. */
export const handleChangesRelations = relations(handleChanges, ({ one }) => ({
  user: one(user, {
    fields: [handleChanges.userId],
    references: [user.id],
  }),
}));
