import { relations } from "drizzle-orm";
import { account, session, user } from "./auth";
import { handleChanges, referralClicks } from "./rate-limit";
import { resumes } from "./resume";
import { siteData } from "./site";

// =============================================================================
// Relations
// =============================================================================

/**
 * User relations — one user has many sessions, accounts, resumes, and handle changes;
 * exactly one siteData row; and many referral clicks both as referrer and as converted user.
 */
export const userRelations = relations(user, ({ many, one }) => ({
	sessions: many(session),
	accounts: many(account),
	resumes: many(resumes),
	siteData: one(siteData, {
		fields: [user.id],
		references: [siteData.userId],
	}),
	handleChanges: many(handleChanges),
	referralClicks: many(referralClicks, { relationName: "referrer" }),
	convertedReferrals: many(referralClicks, { relationName: "convertedUser" }),
}));

/** Session relation — each session belongs to exactly one user. */
export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

/** Account relation — each OAuth account belongs to exactly one user. */
export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
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

/**
 * Referral clicks relations — self-referential pattern on the user table.
 * "referrer" is the user who shared the link; "convertedUser" is the user who signed up.
 * Both use relationName to disambiguate the dual many-to-one links back to user.
 */
export const referralClicksRelations = relations(referralClicks, ({ one }) => ({
	referrer: one(user, {
		fields: [referralClicks.referrerUserId],
		references: [user.id],
		relationName: "referrer",
	}),
	convertedUser: one(user, {
		fields: [referralClicks.convertedUserId],
		references: [user.id],
		relationName: "convertedUser",
	}),
}));
