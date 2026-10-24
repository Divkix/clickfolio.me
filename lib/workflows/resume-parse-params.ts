import { z } from "zod";

// Payload of ResumeParseWorkflow, shared by the services that start it and the class that runs it.
// Kept apart from both so neither drags in the other (the class needs `cloudflare:workers`).

// `workflows[].name` in wrangler.jsonc.
export const PARSE_WORKFLOW_NAME = "clickfolio-resume-parse";

export const resumeParseParamsSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("parse"),
    resumeId: z.string(),
    userId: z.string(),
    r2Key: z.string(),
    fileHash: z.string(),
    // The row's `retry_count` when the run was started.
    retryCount: z.number().int(),
  }),
  /** Durable timer for a `waiting_for_cache` row: fails it if no identical parse completes it. */
  z.object({ kind: z.literal("await-cache"), resumeId: z.string() }),
]);

export type ResumeParseParams = z.infer<typeof resumeParseParamsSchema>;

/** Links a run's step spans to the `workflow.create` span of the request that started it. */
export function parseRunAttributes(instanceId: string, resumeId: string) {
  return {
    "workflow.name": PARSE_WORKFLOW_NAME,
    "workflow.instance_id": instanceId,
    "resume.id": resumeId,
  };
}

/**
 * Instance id for one parse start. Workflows only accepts an id that is unique within the Workflow,
 * and a start can burn its id without using it (create persisted the instance, then the create and
 * the confirming lookup both failed), so the id cannot be derived from row state: every start gets
 * its own. `retryCount` stays in the readable prefix and in the params, where the ownership guard
 * reads it. 81 characters for a UUID resume id, inside the 100-character limit.
 */
export function parseInstanceId(resumeId: string, retryCount = 0): string {
  const run = retryCount > 0 ? `${resumeId}-retry-${retryCount}` : resumeId;

  return `${run}-${crypto.randomUUID()}`;
}
