import { z } from "zod";

// Payload of ResumeParseWorkflow, shared by the services that start it and the class that runs it.
// Kept apart from both so neither drags in the other (the class needs `cloudflare:workers`).

// `workflows[].name` in wrangler.jsonc.
export const PARSE_WORKFLOW_NAME = "clickfolio-resume-parse";

// As loose as the TypeScript type this replaced: a run started by an older deploy may still be in
// flight, and a payload this schema refused would leave its row stuck in `processing`.
export const resumeParseParamsSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("parse"),
    resumeId: z.string(),
    userId: z.string(),
    r2Key: z.string(),
    fileHash: z.string(),
    // The row's `retry_count` when the run was started. Absent on runs started by an older deploy.
    retryCount: z.number().int().optional(),
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

/** Instance id of the first parse run; each manual retry gets its own id. */
export function parseInstanceId(resumeId: string, retryCount = 0): string {
  return retryCount > 0 ? `${resumeId}-retry-${retryCount}` : resumeId;
}
