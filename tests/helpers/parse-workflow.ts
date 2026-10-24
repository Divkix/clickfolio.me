import { vi } from "vite-plus/test";
import type { ResumeParseParams } from "@/lib/workflows/resume-parse-params";

export type ParseWorkflow = {
  create: (options: { id: string; params: ResumeParseParams }) => Promise<{ id: string }>;
  get: (id: string) => Promise<{ id: string }>;
};

/** Records each parse start the real WorkflowStarter makes through `parseWorkflow.create`. */
export const startResumeParse = vi.fn(
  async (_workflow: ParseWorkflow, _id: string, _params: ResumeParseParams): Promise<void> => {},
);

/** A CLICKFOLIO_PARSE_WORKFLOW binding for route tests; reject `startResumeParse` to fail a start. */
export const parseWorkflow: ParseWorkflow = {
  create: async ({ id, params }: { id: string; params: ResumeParseParams }) => {
    await startResumeParse(parseWorkflow, id, params);

    return { id };
  },
  get: async (_id: string): Promise<{ id: string }> => {
    throw new Error("instance.not_found");
  },
};
