import type { ResumeContentFormData } from "@/lib/schemas/resume";

export type ResumeContent = ResumeContentFormData;

export type Project = NonNullable<ResumeContent["projects"]>[number];
