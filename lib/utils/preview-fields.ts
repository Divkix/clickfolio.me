/**
 * Preview fields extraction utility for siteData denormalized columns
 * Extracts essential preview information from ResumeContent for quick access
 */

import { flattenSkills } from "@/lib/templates/helpers";
import type { ResumeContent } from "@/lib/types/database";

/**
 * Return type for extractPreviewFields function
 */
export interface PreviewFields {
  previewName: string | null;
  previewHeadline: string | null;
  previewLocation: string | null;
  previewExpCount: number;
  previewEduCount: number;
  previewSkills: string;
}

/**
 * Extracts denormalized preview fields from resume content
 * Used for quick access to essential data without parsing full JSON
 *
 * @param content - The parsed resume content, may be null/undefined
 * @returns Object with preview fields, all properly defaulted for null safety
 *
 * @example
 * const content = { full_name: "John Doe", skills: [{ category: "Languages", items: ["JS", "TS"] }] };
 * extractPreviewFields(content);
 * // Returns: { previewName: "John Doe", previewHeadline: null, ..., previewSkills: '["JS","TS"]' }
 *
 * @example
 * extractPreviewFields(null);
 * // Returns: { previewName: null, previewHeadline: null, ..., previewExpCount: 0, previewSkills: '[]' }
 */
export function extractPreviewFields(content: ResumeContent | null | undefined): PreviewFields {
  // Handle null/undefined content
  if (!content) {
    return {
      previewName: null,
      previewHeadline: null,
      previewLocation: null,
      previewExpCount: 0,
      previewEduCount: 0,
      previewSkills: "[]",
    };
  }

  // Extract and flatten skills from skill groups, taking first 4
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
    previewSkills: JSON.stringify(flattenedSkills),
  };
}
