import { Cause, Effect } from "effect";
import type { ParseErrorJson } from "../parse/errors";
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { classifyParseError, decodeParseError } from "../parse/errors";
import { toParseErrorJson } from "../parse/failures";
import { runStep } from "./run-step";
import { sendResumeFailureEmail } from "../parse/email";
import {
  claimResumeForParse,
  completeParsedResume,
  expireWaitingForCache,
  markResumeParseFailed,
  parseResumePdf,
  readLastParseFailure,
} from "../parse/pipeline";
import { WAITING_FOR_CACHE_TIMEOUT_MS } from "../resume/lifecycle";
import type { ResumeParseParams } from "./resume-parse";
import { log } from "../utils/log";

const DB_STEP = {
  retries: { limit: 5, delay: "5 seconds", backoff: "exponential" },
  timeout: "1 minute",
} as const;

// Transient failures (AI provider, DB, R2 throttling) retry here; permanent ones
// throw NonRetryableError and go straight to `mark failed`.
const PARSE_STEP = {
  retries: { limit: 3, delay: "30 seconds", backoff: "exponential" },
  timeout: "10 minutes",
} as const;

/**
 * Resume parse pipeline: claim → parse → complete, with `mark failed` once
 * retries are spent. Replaces the parse queue, its DLQ, and the orphan-recovery cron.
 */
export class ResumeParseWorkflow extends WorkflowEntrypoint<CloudflareEnv, ResumeParseParams> {
  private async emailFailure(resumeId: string, step: WorkflowStep): Promise<void> {
    try {
      // Journal email separately from retryable database work. The provider has no
      // idempotency key, so do not retry an ambiguous send or a timed-out step.
      await step.do(
        "email parse failure",
        { retries: { limit: 0, delay: "1 second" }, timeout: "30 seconds" },
        () => sendResumeFailureEmail(resumeId, this.env),
      );
    } catch {
      log("error", "resume failure email step failed", { resumeId });
    }
  }

  async run(event: WorkflowEvent<ResumeParseParams>, step: WorkflowStep): Promise<string> {
    const params = event.payload;

    if (params.kind === "await-cache") {
      await step.sleep("wait for cached parse", WAITING_FOR_CACHE_TIMEOUT_MS);

      const expired = await step.do("expire waiting row", DB_STEP, () =>
        expireWaitingForCache(params.resumeId, this.env),
      );

      if (expired) await this.emailFailure(params.resumeId, step);

      return expired ? "expired" : "resolved";
    }

    const job = {
      resumeId: params.resumeId,
      userId: params.userId,
      r2Key: params.r2Key,
      fileHash: params.fileHash,
    };

    const claim = await step.do("claim", DB_STEP, () => claimResumeForParse(job, this.env));

    if (claim !== "parse") return claim;

    let failedDuringParse = true;
    let currentFailure: ParseErrorJson | null = null;

    try {
      const parsed = await step.do("parse", PARSE_STEP, () =>
        runStep(
          parseResumePdf(job, this.env).pipe(
            Effect.tapCause((cause) =>
              Effect.sync(() => {
                const defect = cause.reasons.find(Cause.isDieReason);
                currentFailure = toParseErrorJson(
                  classifyParseError(defect ? defect.defect : Cause.squash(cause)),
                );
              }),
            ),
          ),
        ),
      );

      failedDuringParse = false;
      currentFailure = null;

      if (!parsed) return "skipped";

      await step.do("complete", DB_STEP, () => completeParsedResume(job, parsed, this.env));

      return "completed";
    } catch (error) {
      await step.do("mark failed", DB_STEP, async () => {
        // The Workflow engine may serialize thrown Errors. The row retains the
        // original failure metadata even when Error.cause is lost on replay.
        const fallback = toParseErrorJson(classifyParseError(error));

        const currentDatabaseFailure =
          fallback.type === "db_connection_error" || fallback.type === "parse_validation_error"
            ? fallback
            : null;

        const carried =
          currentFailure ?? (error instanceof Error ? decodeParseError(error.cause) : null);

        const stored =
          failedDuringParse && !carried && !currentDatabaseFailure
            ? await readLastParseFailure(job, this.env)
            : null;

        const failure = carried ?? currentDatabaseFailure ?? stored ?? fallback;
        await markResumeParseFailed(job, failure, this.env);
      });

      await this.emailFailure(job.resumeId, step);

      throw error;
    }
  }
}
