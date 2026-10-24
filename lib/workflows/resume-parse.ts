import { Cause, Exit } from "effect";
import { runBackground } from "../effect/edges";
import { WorkflowStarter } from "../effect/services/workflow-starter";
import type { ResumeParseParams } from "./resume-parse-params";

// Trigger side of ResumeParseWorkflow. Kept apart from the class so routes can
// start runs without importing `WorkflowEntrypoint` and the parse pipeline.

export { parseInstanceId, type ResumeParseParams } from "./resume-parse-params";

export type ResumeParseWorkflowBinding = Workflow<ResumeParseParams>;

/**
 * Promise edge for callers that have not moved to `WorkflowStarter` yet; remove with the last of
 * them. Throws the typed `WorkflowFailed` / `InvalidInput`.
 */
export async function startResumeParse(
  workflow: Pick<ResumeParseWorkflowBinding, "create" | "get">,
  id: string,
  params: ResumeParseParams,
): Promise<void> {
  const exit = await runBackground(
    WorkflowStarter.use((starter) => starter.startResumeParse(id, params)),
    WorkflowStarter.layerFrom(workflow),
  );

  if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
}
