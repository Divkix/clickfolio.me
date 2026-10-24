import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { resumes, user } from "../db/schema";
import { Db } from "../effect/db";
import { upstreamLogFields } from "../effect/failure-fields";
import { Mailer } from "../effect/services/mailer";
import { errorFields } from "../utils/error-fields";
import { log } from "../utils/log";

type FailureEmailConfig = { readonly appUrl: string; readonly from: string };

/**
 * Looks up the verified account owner of a failed resume and mails them once. Never retried:
 * the provider has no idempotency key, so a retry after a timeout could send it twice.
 * Resolves `skipped` when there is nobody to tell (resume gone or no longer failed, owner
 * anonymous or unverified); the recipient is always the Clerk account email, never the
 * contact email on the resume.
 */
export function resumeFailureEmail(resumeId: string, config: FailureEmailConfig) {
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
 * `resumeFailureEmail` for callers that must not fail because of it: every typed failure is
 * logged (scrubbed, flagged `outcome_unknown` after a timeout) and then dropped.
 */
export function resumeFailureEmailBestEffort(resumeId: string, config: FailureEmailConfig) {
  return resumeFailureEmail(resumeId, config).pipe(
    Effect.catchTags({
      DbFailed: (failure) =>
        Effect.sync(() =>
          log("error", "resume failure email failed", {
            resumeId,
            ...upstreamLogFields(failure),
          }),
        ),
      DbConflict: (failure) =>
        Effect.sync(() =>
          log("error", "resume failure email failed", {
            resumeId,
            failure: failure._tag,
            ...errorFields(failure.cause ?? failure.message),
          }),
        ),
      EmailFailed: (failure) =>
        Effect.sync(() =>
          log("error", "resume failure email failed", {
            resumeId,
            ...upstreamLogFields(failure),
          }),
        ),
    }),
    Effect.asVoid,
  );
}
