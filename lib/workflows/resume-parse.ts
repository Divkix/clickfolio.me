import type { ResumeParseJob } from "../parse/pipeline";
import { withSpan } from "../telemetry/spans";

// Trigger side of ResumeParseWorkflow. Kept apart from the class so routes can
// start runs without importing `WorkflowEntrypoint` and the parse pipeline.

// `workflows[].name` in wrangler.jsonc.
const WORKFLOW_NAME = "clickfolio-resume-parse";

/** Links a run's step spans to the `workflow.create` span of the request that started it. */
export function parseRunAttributes(instanceId: string, resumeId: string) {
  return {
    "workflow.name": WORKFLOW_NAME,
    "workflow.instance_id": instanceId,
    "resume.id": resumeId,
  };
}

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
  workflow: Pick<ResumeParseWorkflowBinding, "create" | "get">,
  id: string,
  params: ResumeParseParams,
): Promise<void> {
  // The runtime exposes no trace context to pass on, so the run's step spans
  // repeat these ids instead.
  const attributes = {
    ...parseRunAttributes(id, params.resumeId),
    "workflow.params.kind": params.kind,
  };

  await withSpan(`workflow.create ${WORKFLOW_NAME}`, attributes, async () => {
    try {
      await workflow.create({ id, params });
    } catch (error) {
      const existing = await workflow.get(id).catch(() => null);

      if (!existing) throw error;
    }
  });
}
