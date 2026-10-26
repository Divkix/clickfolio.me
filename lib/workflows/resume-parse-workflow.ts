/**
 * Journaled claim → parse → complete; terminal failures run `mark failed`.
 * Database steps use status-guarded UPDATE ... RETURNING and SQL-side attempt increments;
 * their retryCount guards keep an older run from touching a manually retried row.
 * A retried `complete` resolves the owner's handle even after its first commit, so public
 * refresh still runs. `mark failed` returns a notice; `announce parse failure` journals its
 * status pushes and alert separately with no retries, avoiding duplicates on DB-step retries.
 * Failure email likewise runs separately after DB work, without automatic retries.
 */

import { Cause, Effect } from "effect";
import type { ParseErrorJson } from "../parse/errors";
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
  type WorkflowStepConfig,
  type WorkflowStepContext,
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { getAlertChannel } from "../parse/alert";
import { classifyParseError, decodeParseError } from "../parse/errors";
import { toParseErrorJson, type ParseFailure } from "../parse/failures";
import type { ServerFailure } from "../effect/failures";
import { runWorkflowStep } from "./run-workflow-step";
import { resumeFailureEmailBestEffort } from "../parse/email";
import {
  parseWorkflowLayer,
  type ParseWorkflowEnv,
  type ParseWorkflowServices,
} from "../parse/layers";
import {
  announceResumeParseFailure,
  claimResumeForParse,
  completeParsedResume,
  expireWaitingForCache,
  markResumeParseFailed,
  parseResumePdf,
  readLastParseFailure,
  type ParseFailureNotice,
  type ResumeParseJob,
} from "../parse/pipeline";
import { refreshPublicProfiles } from "../parse/public-refresh";
import { RETRY_LIMITS, WAITING_FOR_CACHE_TIMEOUT_MS } from "../resume/lifecycle";
import {
  parseRunAttributes,
  resumeParseParamsSchema,
  type ResumeParseParams,
} from "./resume-parse-params";
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
  retries: {
    limit: RETRY_LIMITS.PARSE_MAX_ATTEMPTS - 1,
    delay: "30 seconds",
    backoff: "exponential",
  },
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
function tracedSteps(step: WorkflowStep, instanceId: string, resumeId: string): TracedStep {
  const attributes = parseRunAttributes(instanceId, resumeId);

  return (name, config, run) =>
    step.do(name, config, (context) =>
      withSpan(
        `workflow.step ${name}`,
        { ...attributes, "workflow.step.name": name, "workflow.step.attempt": context.attempt },
        () => run(context),
      ),
    );
}

export class ResumeParseWorkflow extends WorkflowEntrypoint<ParseWorkflowEnv, ResumeParseParams> {
  /**
   * Runs one step's Effect with the layers built for this attempt (never held across steps) and
   * maps its failure to what `step.do` expects: retry, or NonRetryableError.
   */
  private exec<A, E extends ServerFailure | ParseFailure>(
    program: Effect.Effect<A, E, ParseWorkflowServices>,
  ): Promise<A> {
    return runWorkflowStep(Effect.provide(program, parseWorkflowLayer(this.env)));
  }

  private async refreshPublicPages(handles: string[], tracedStep: TracedStep): Promise<void> {
    if (handles.length === 0) return;

    try {
      // Its own journaled step, after the row is final: the purge enqueue and the IndexNow ping
      // are not idempotent for the rate budget, so an ambiguous step is not retried.
      await tracedStep(
        "refresh public pages",
        { retries: { limit: 0, delay: "1 second" }, timeout: "30 seconds" },
        () => this.exec(refreshPublicProfiles(handles, this.env.APP_URL)),
      );
    } catch (error) {
      // Not rethrown: stale pages age out with the page TTL, and the parse already succeeded.
      log("error", "public page refresh step failed", errorFields(error));
    }
  }

  private async emailFailure(resumeId: string, tracedStep: TracedStep): Promise<void> {
    try {
      // Journal email separately from retryable database work. The provider has no
      // idempotency key, so do not retry an ambiguous send or a timed-out step.
      await tracedStep(
        "email parse failure",
        { retries: { limit: 0, delay: "1 second" }, timeout: "30 seconds" },
        () =>
          this.exec(
            // Without the binding (local runs) there is nobody to mail: skip quietly.
            this.env.EMAIL
              ? resumeFailureEmailBestEffort(resumeId, {
                  appUrl: this.env.APP_URL,
                  from: this.env.EMAIL_FROM,
                })
              : Effect.void,
          ),
      );
    } catch (error) {
      // Not rethrown: a failed email must not fail the run after the row is final.
      log("error", "resume failure email step failed", { resumeId, ...errorFields(error) });
    }
  }

  private async announceFailure(
    job: ResumeParseJob,
    notice: ParseFailureNotice,
    tracedStep: TracedStep,
  ): Promise<void> {
    try {
      // The status pushes and the alert webhook have no idempotency key, so they get a journaled
      // step of their own with no retries: a retry of `mark failed` cannot send them twice.
      await tracedStep(
        "announce parse failure",
        { retries: { limit: 0, delay: "1 second" }, timeout: "30 seconds" },
        () =>
          this.exec(
            announceResumeParseFailure(job, notice, getAlertChannel(this.env.ALERT_CHANNEL)),
          ),
      );
    } catch (error) {
      // Not rethrown: a failed announcement must not fail the run after the row is final.
      log("error", "resume failure announce step failed", {
        resumeId: job.resumeId,
        ...errorFields(error),
      });
    }
  }

  async run(event: WorkflowEvent<ResumeParseParams>, step: WorkflowStep): Promise<string> {
    // A payload that fails validation has no row this run can safely mark failed.
    const checked = resumeParseParamsSchema.safeParse(event.payload);

    if (!checked.success) {
      log("error", "resume parse workflow payload invalid", {
        instanceId: event.instanceId,
        fields: checked.error.issues.map((issue) => issue.path.join(".")),
      });

      throw new NonRetryableError("InvalidInput: invalid resume parse payload");
    }

    const params = checked.data;
    const tracedStep = tracedSteps(step, event.instanceId, params.resumeId);

    if (params.kind === "await-cache") {
      await step.sleep("wait for cached parse", WAITING_FOR_CACHE_TIMEOUT_MS);

      const expired = await tracedStep("expire waiting row", DB_STEP, () =>
        this.exec(expireWaitingForCache(params.resumeId)),
      );

      if (expired) await this.emailFailure(params.resumeId, tracedStep);

      return expired ? "expired" : "resolved";
    }

    const job = {
      resumeId: params.resumeId,
      userId: params.userId,
      r2Key: params.r2Key,
      fileHash: params.fileHash,
      retryCount: params.retryCount,
    };

    const claim = await tracedStep("claim", DB_STEP, () => this.exec(claimResumeForParse(job)));

    if (claim !== "parse" && claim !== "skipped") {
      await this.refreshPublicPages(claim.handles, tracedStep);

      return "cached";
    }

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

        return this.exec(
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

      const rewritten = await tracedStep("complete", DB_STEP, async () => {
        const handles = await this.exec(completeParsedResume(job, parsed));

        logEvent("resume_parse_completed", outcome());

        return handles;
      });

      await this.refreshPublicPages(rewritten, tracedStep);

      return "completed";
    } catch (error) {
      const notice = await tracedStep("mark failed", DB_STEP, () =>
        this.exec(
          Effect.gen(function* () {
            // The Workflow engine may serialize thrown Errors. The row retains the
            // original failure metadata even when Error.cause is lost on replay.
            const fallback = toParseErrorJson(classifyParseError(error));

            const currentDatabaseFailure =
              fallback.type === "db_connection_error" || fallback.type === "parse_validation_error"
                ? fallback
                : null;

            const carried =
              currentFailure ?? (error instanceof Error ? decodeParseError(error.cause) : null);

            const needsStored = failedDuringParse && !carried && !currentDatabaseFailure;
            const stored = needsStored ? yield* readLastParseFailure(job) : null;
            const resolved = carried ?? currentDatabaseFailure ?? stored ?? fallback;

            const marked = yield* markResumeParseFailed(job, resolved);

            // After the write, inside the step body: once per run, not once per
            // step retry or per replay of `run`.
            logEvent(
              "resume_parse_failed",
              { ...outcome(), errorType: resolved.type, ...errorFields(error) },
              "error",
            );

            return marked;
          }),
        ),
      );

      // A superseded or deleted row has no failure owned by this run.
      if (notice) {
        await this.announceFailure(job, notice, tracedStep);
        await this.emailFailure(job.resumeId, tracedStep);
      }

      throw error;
    }
  }
}
