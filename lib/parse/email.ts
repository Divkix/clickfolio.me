/**
 * Best-effort permanent parse-failure/cache-expiry mail to verified Clerk account owners,
 * never resume contact addresses. Skip missing/non-failed resumes and anonymous/unverified owners.
 * ResumeParseWorkflow journals email in its own step after DB work, with automatic retries
 * disabled; delivery failures must not block the committed status update.
 * The EMAIL send_email binding has no idempotency key: a timeout is logged outcome_unknown,
 * never retried. A crash after provider acceptance but before journaling can still duplicate mail.
 * Keep EMAIL_FROM and EMAIL.allowed_sender_addresses aligned to the sender on an onboarded
 * domain. Local sends are simulated unless the binding explicitly enables remote: true.
 */

import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { resumes, user } from "../db/schema";
import { Db } from "../effect/db";
import { upstreamLogFields } from "../effect/failure-fields";
import { Mailer } from "../effect/services/mailer";
import { errorFields } from "../utils/error-fields";
import { log } from "../utils/log";

type FailureEmailConfig = { readonly appUrl: string; readonly from: string };

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
