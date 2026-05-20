import { relations } from "drizzle-orm";
import { account, session, user } from "./auth";
import { handleChanges, referralClicks } from "./rate-limit";
import { resumes } from "./resume";
import { siteData } from "./site";

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
