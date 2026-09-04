import { flattenSkills } from "@/lib/templates/helpers";
import type { ResumeContent } from "@/lib/types/database";

export interface PreviewFields {
  previewName: string | null;
  previewHeadline: string | null;
  previewLocation: string | null;
  previewExpCount: number;
  previewEduCount: number;
  previewSkills: string[];
}

export function extractPreviewFields(content: ResumeContent | null | undefined): PreviewFields {
  if (!content) {
    return {
      previewName: null,
      previewHeadline: null,
      previewLocation: null,
      previewExpCount: 0,
      previewEduCount: 0,
      previewSkills: [],
    };
  }

  const flattenedSkills = flattenSkills(content.skills)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  return {
    previewName: content.full_name || null,
    previewHeadline: content.headline || null,
    previewLocation: content.contact?.location || null,
    previewExpCount: Array.isArray(content.experience) ? content.experience.length : 0,
    previewEduCount: Array.isArray(content.education) ? content.education.length : 0,
    previewSkills: flattenedSkills,
  };
}
