import type { ResumeParseJob } from "../parse/pipeline";

// Trigger side of ResumeParseWorkflow. Kept apart from the class so routes can
// start runs without importing `cloudflare:workers`.

export type ResumeParseParams =
  | ({ kind: "parse" } & ResumeParseJob)
  /** Durable timer for a `waiting_for_cache` row: fails it if no identical parse completes it. */
  | { kind: "await-cache"; resumeId: string };

export type ResumeParseWorkflowBinding = Workflow<ResumeParseParams>;

/** Instance id of the first parse run; each manual retry gets its own id. */
export function parseInstanceId(resumeId: string, retryCount = 0): string {
  return retryCount > 0 ? `${resumeId}-retry-${retryCount}` : resumeId;
}

/**
 * Starts a run under an id derived from the resume, so the id is the idempotency
 * key: a create that errored after the instance was persisted is not an error.
 */
export async function startResumeParse(
  workflow: ResumeParseWorkflowBinding,
  id: string,
  params: ResumeParseParams,
): Promise<void> {
  try {
    await workflow.create({ id, params });
  } catch (error) {
    const existing = await workflow.get(id).catch(() => null);

    if (!existing) throw error;
  }
}
