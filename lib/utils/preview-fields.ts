/**
 * Preview fields extraction utility for siteData denormalized columns
 * Extracts essential preview information from ResumeContent for quick access
 */

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
  const flattenedSkills = extractTopSkills(content.skills, 4);

  return {
    previewName: content.full_name || null,
    previewHeadline: content.headline || null,
    previewLocation: content.contact?.location || null,
    previewExpCount: Array.isArray(content.experience) ? content.experience.length : 0,
    previewEduCount: Array.isArray(content.education) ? content.education.length : 0,
    previewSkills: JSON.stringify(flattenedSkills),
  };
}

/**
 * Extracts and flattens skills from skill groups
 *
 * @param skills - Array of skill groups, each containing category and items
 * @param limit - Maximum number of skills to return
 * @returns Flattened array of skill strings, limited to specified count
 *
 * @example
 * extractTopSkills([{ category: "Frontend", items: ["React", "Vue"] }], 4);
 * // Returns: ["React", "Vue"]
 */
export function extractTopSkills(
  skills: ResumeContent["skills"] | null | undefined,
  limit: number,
): string[] {
  if (!skills || !Array.isArray(skills)) {
    return [];
  }

  const flattened: string[] = [];

  for (const skillGroup of skills) {
    // Skip invalid skill groups
    if (!skillGroup || !Array.isArray(skillGroup.items)) {
      continue;
    }

    for (const item of skillGroup.items) {
      // Skip empty or non-string items
      if (typeof item !== "string" || item.trim() === "") {
        continue;
      }

      flattened.push(item.trim());

      // Stop early if we've reached the limit
      if (flattened.length >= limit) {
        return flattened;
      }
    }
  }

  return flattened;
}
