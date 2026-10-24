import { Cause, Effect } from "effect";
import type { ParseErrorJson } from "../parse/errors";
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
  type WorkflowStepConfig,
  type WorkflowStepContext,
} from "cloudflare:workers";
import { classifyParseError, decodeParseError } from "../parse/errors";
import { toParseErrorJson } from "../parse/failures";
import { runWorkflowStep } from "./run-workflow-step";
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
import { parseRunAttributes, type ResumeParseParams } from "./resume-parse";
import { resolveAiModel } from "../ai/prompt-config";
import { log, logEvent } from "../utils/log";
import { errorFields } from "../utils/error-fields";
import { withSpan } from "../telemetry/spans";

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

type TracedStep = <T extends Rpc.Serializable<T>>(
  name: string,
  config: WorkflowStepConfig,
  run: (context: WorkflowStepContext) => Promise<T>,
) => Promise<T>;

/**
 * `step.do` with its body in a span. A replayed step returns from the journal
 * without a span. The instance and resume ids link the run to the request that
 * started it (`workflow.create` in `startResumeParse`).
 */
function tracedSteps(step: WorkflowStep, event: WorkflowEvent<ResumeParseParams>): TracedStep {
  const attributes = parseRunAttributes(event.instanceId, event.payload.resumeId);

  return (name, config, run) =>
    step.do(name, config, (context) =>
      withSpan(
        `workflow.step ${name}`,
        { ...attributes, "workflow.step.name": name, "workflow.step.attempt": context.attempt },
        () => run(context),
      ),
    );
}

/**
 * Resume parse pipeline: claim → parse → complete, with `mark failed` once
 * retries are spent. Replaces the parse queue, its DLQ, and the orphan-recovery cron.
 */
export class ResumeParseWorkflow extends WorkflowEntrypoint<CloudflareEnv, ResumeParseParams> {
  private async emailFailure(resumeId: string, tracedStep: TracedStep): Promise<void> {
    try {
      // Journal email separately from retryable database work. The provider has no
      // idempotency key, so do not retry an ambiguous send or a timed-out step.
      await tracedStep(
        "email parse failure",
        { retries: { limit: 0, delay: "1 second" }, timeout: "30 seconds" },
        () => sendResumeFailureEmail(resumeId, this.env),
      );
    } catch (error) {
      // Not rethrown: a failed email must not fail the run after the row is final.
      log("error", "resume failure email step failed", { resumeId, ...errorFields(error) });
    }
  }

  async run(event: WorkflowEvent<ResumeParseParams>, step: WorkflowStep): Promise<string> {
    const params = event.payload;
    const tracedStep = tracedSteps(step, event);

    if (params.kind === "await-cache") {
      await step.sleep("wait for cached parse", WAITING_FOR_CACHE_TIMEOUT_MS);

      const expired = await tracedStep("expire waiting row", DB_STEP, () =>
        expireWaitingForCache(params.resumeId, this.env),
      );

      if (expired) await this.emailFailure(params.resumeId, tracedStep);

      return expired ? "expired" : "resolved";
    }

    const job = {
      resumeId: params.resumeId,
      userId: params.userId,
      r2Key: params.r2Key,
      fileHash: params.fileHash,
    };

    const claim = await tracedStep("claim", DB_STEP, () => claimResumeForParse(job, this.env));

    if (claim !== "parse") return claim;

    let failedDuringParse = true;
    let currentFailure: ParseErrorJson | null = null;
    // Unknown when the parse result comes from the journal (a replayed run).
    let parseAttempts: number | undefined;

    // Fields for the run's one resume_parse_completed / resume_parse_failed event.
    // `duration_ms` runs from the instance's creation, so it includes retry backoff.
    const outcome = () => ({
      resumeId: job.resumeId,
      model: resolveAiModel(this.env),
      attempts: parseAttempts,
      duration_ms: Date.now() - event.timestamp.getTime(),
    });

    try {
      const parsed = await tracedStep("parse", PARSE_STEP, (context) => {
        parseAttempts = context.attempt;

        return runWorkflowStep(
          parseResumePdf(job, this.env).pipe(
            Effect.tapCause((cause) =>
              Effect.sync(() => {
                const defect = cause.reasons.find(Cause.isDieReason);
                const raw = defect ? defect.defect : Cause.squash(cause);
                currentFailure = toParseErrorJson(classifyParseError(raw));

                // Logged per attempt inside the step body; the step's retries
                // and its terminal throw are left to the Workflow engine.
                log("warn", "resume parse attempt failed", {
                  resumeId: job.resumeId,
                  errorType: currentFailure.type,
                  retryable: currentFailure.isRetryable,
                  ...errorFields(raw),
                });
              }),
            ),
          ),
        );
      });

      failedDuringParse = false;
      currentFailure = null;

      if (!parsed) return "skipped";

      await tracedStep("complete", DB_STEP, async () => {
        await completeParsedResume(job, parsed, this.env);
        logEvent("resume_parse_completed", outcome());
      });

      return "completed";
    } catch (error) {
      await tracedStep("mark failed", DB_STEP, async () => {
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

        // After the write, inside the step body: once per run, not once per
        // step retry or per replay of `run`.
        logEvent(
          "resume_parse_failed",
          { ...outcome(), errorType: failure.type, ...errorFields(error) },
          "error",
        );
      });

      await this.emailFailure(job.resumeId, tracedStep);

      throw error;
    }
  }
}
