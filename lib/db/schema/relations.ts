import { relations } from "drizzle-orm";
import { user } from "./auth";
import { handleChanges } from "./rate-limit";
import { resumes } from "./resume";
import { siteData } from "./site";

export const userRelations = relations(user, ({ many, one }) => ({
  resumes: many(resumes),
  siteData: one(siteData, {
    fields: [user.id],
    references: [siteData.userId],
  }),
  handleChanges: many(handleChanges),
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
