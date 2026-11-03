import { Effect } from "effect";
import { and, eq, exists, isNotNull, isNull } from "drizzle-orm";
import { resumes, siteData, user } from "../db/schema";
import { Db } from "../effect/db";
import { upstreamLogFields } from "../effect/failure-fields";
import type { DbConflict, DbFailed, EmailFailed } from "../effect/failures";
import { Mailer } from "../effect/services/mailer";
import { errorFields } from "../utils/error-fields";
import { log } from "../utils/log";

export type EmailConfig = { readonly appUrl: string; readonly from: string };

/**
 * Looks up the verified account owner of a failed resume and mails them once. Never retried:
 * the provider has no idempotency key, so a retry after a timeout could send it twice.
 * Resolves `skipped` when there is nobody to tell (resume gone or no longer failed, owner
 * anonymous or unverified); the recipient is always the Clerk account email, never the
 * contact email on the resume.
 */
export function resumeFailureEmail(resumeId: string, config: EmailConfig) {
  return Effect.gen(function* () {
    const resume = yield* Db.use((db) =>
      db.query("email.resume", (handle) =>
        handle.query.resumes.findFirst({
          where: eq(resumes.id, resumeId),
          columns: { userId: true, status: true },
        }),
      ),
    );

    // Account deletion or a manual retry may have resolved the failure already.
    if (!resume || resume.status !== "failed") return "skipped" as const;

    const owner = yield* Db.use((db) =>
      db.query("email.owner", (handle) =>
        handle.query.user.findFirst({
          where: eq(user.id, resume.userId),
          columns: { email: true, emailVerified: true, clerkId: true },
        }),
      ),
    );

    if (!owner?.clerkId || !owner.emailVerified) return "skipped" as const;

    const dashboardUrl = new URL("/dashboard", config.appUrl).href;

    const receipt = yield* Mailer.use((mailer) =>
      mailer.send({
        to: owner.email,
        from: config.from,
        subject: "Your resume needs another try",
        text: `We couldn't finish processing your resume. Open your clickfolio.me dashboard to see what went wrong and retry or upload a new PDF.\n\n${dashboardUrl}\n\nYour existing portfolio is still available if you already published one.`,
      }),
    );

    log("info", "resume failure email accepted", { resumeId, messageId: receipt.messageId });

    return "sent" as const;
  });
}

/**
 * Mails the account owner their public link the first time their portfolio is live: a handle,
 * a verified Clerk account, and published site_data holding parsed content (the wizard's
 * placeholder row has no resume_id). Claiming `live_email_sent_at` in the same statement makes
 * it once per user across every path that publishes (parse completion, wizard completion,
 * replays). A send that fails after the claim is never retried: the provider has no
 * idempotency key.
 */
export function portfolioLiveEmail(userId: string, config: EmailConfig) {
  return Effect.gen(function* () {
    // Before the claim: a bad APP_URL must not use up the user's only email.
    const dashboardUrl = new URL("/dashboard", config.appUrl).href;

    const [claimed] = yield* Db.use((db) =>
      db.query("email.live.claim", (handle) =>
        handle
          .update(user)
          .set({ liveEmailSentAt: new Date().toISOString() })
          .where(
            and(
              eq(user.id, userId),
              isNull(user.liveEmailSentAt),
              isNotNull(user.handle),
              isNotNull(user.clerkId),
              eq(user.emailVerified, true),
              exists(
                handle
                  .select({ id: siteData.id })
                  .from(siteData)
                  .where(
                    and(
                      eq(siteData.userId, user.id),
                      isNotNull(siteData.resumeId),
                      isNotNull(siteData.lastPublishedAt),
                    ),
                  ),
              ),
            ),
          )
          .returning({ email: user.email, handle: user.handle }),
      ),
    );

    if (!claimed?.handle) return "skipped" as const;

    const profileUrl = new URL(`/@${claimed.handle}`, config.appUrl).href;

    const receipt = yield* Mailer.use((mailer) =>
      mailer.send({
        to: claimed.email,
        from: config.from,
        subject: "Your portfolio is live",
        text: `Your clickfolio.me portfolio is live. Share it anywhere:\n\n${profileUrl}\n\nTo edit your content, theme or privacy settings, open your dashboard:\n\n${dashboardUrl}\n\nUploading a new resume PDF updates the same link.`,
      }),
    );

    log("info", "portfolio live email accepted", { userId, messageId: receipt.messageId });

    return "sent" as const;
  });
}

/** Logs every typed failure (scrubbed, flagged `outcome_unknown` after a timeout), then drops it. */
function logAndDrop<A, R>(
  program: Effect.Effect<A, DbFailed | DbConflict | EmailFailed, R>,
  message: string,
  fields: Record<string, string>,
) {
  return program.pipe(
    Effect.catchTags({
      DbFailed: (failure) =>
        Effect.sync(() => log("error", message, { ...fields, ...upstreamLogFields(failure) })),
      DbConflict: (failure) =>
        Effect.sync(() =>
          log("error", message, {
            ...fields,
            failure: failure._tag,
            ...errorFields(failure.cause ?? failure.message),
          }),
        ),
      EmailFailed: (failure) =>
        Effect.sync(() => log("error", message, { ...fields, ...upstreamLogFields(failure) })),
    }),
    Effect.asVoid,
  );
}

/** `resumeFailureEmail` for callers that must not fail because of it. */
export function resumeFailureEmailBestEffort(resumeId: string, config: EmailConfig) {
  return logAndDrop(resumeFailureEmail(resumeId, config), "resume failure email failed", {
    resumeId,
  });
}

/** `portfolioLiveEmail` for callers that must not fail because of it. */
export function portfolioLiveEmailBestEffort(userId: string, config: EmailConfig) {
  return logAndDrop(portfolioLiveEmail(userId, config), "portfolio live email failed", {
    userId,
  });
}
