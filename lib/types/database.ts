/**
 * Single source of truth for resume content types — derived from the Zod schema.
 * Keeps types and runtime validation always in sync.
 */
import type { ResumeContentFormData } from "@/lib/schemas/resume";

/** Resume content type derived from the canonical Zod schema. */
export type ResumeContent = ResumeContentFormData;

/** Project entry type derived from ResumeContent. */
export type Project = NonNullable<ResumeContent["projects"]>[number];
