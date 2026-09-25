import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { ParseError } from "../parse/errors";
import {
  claimResumeForParse,
  completeParsedResume,
  expireWaitingForCache,
  markResumeParseFailed,
  parseResumePdf,
} from "../parse/pipeline";
import { WAITING_FOR_CACHE_TIMEOUT_MS } from "../resume/lifecycle";
import type { ResumeParseParams } from "./resume-parse";

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
  async run(event: WorkflowEvent<ResumeParseParams>, step: WorkflowStep): Promise<string> {
    const params = event.payload;

    if (params.kind === "await-cache") {
      await step.sleep("wait for cached parse", WAITING_FOR_CACHE_TIMEOUT_MS);

      const expired = await step.do("expire waiting row", DB_STEP, () =>
        expireWaitingForCache(params.resumeId, this.env),
      );

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

    try {
      const parsed = await step.do("parse", PARSE_STEP, async () => {
        try {
          return await parseResumePdf(job, this.env);
        } catch (error) {
          if (error instanceof ParseError && !error.isRetryable()) {
            throw new NonRetryableError(error.message, error.type);
          }

          throw error;
        }
      });

      if (!parsed) return "skipped";

      await step.do("complete", DB_STEP, () => completeParsedResume(job, parsed, this.env));

      return "completed";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await step.do("mark failed", DB_STEP, () => markResumeParseFailed(job, message, this.env));

      throw error;
    }
  }
}
