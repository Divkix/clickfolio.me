import { z } from "zod/mini";
import type { ResumeContent } from "@/lib/types/database";

const descriptionHighlightsSchema = z.object({
  description: z.string(),
  highlights: z.array(z.string()),
});

function comparisonText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\p{P}\s]+$/u, "")
    .toLowerCase();
}

function normalizeEntry<T extends { description: string; highlights?: string[] }>(entry: T): T {
  // Stored rows allow older shapes; only compare descriptions with string bullets.
  const parsed = z.safeParse(descriptionHighlightsSchema, entry);

  if (!parsed.success || !parsed.data.description || !parsed.data.highlights.length) return entry;

  const description = comparisonText(parsed.data.description);
  const highlights = parsed.data.highlights.map(comparisonText);

  if (
    description &&
    (highlights.includes(description) ||
      comparisonText(parsed.data.highlights.join(" ")) === description ||
      comparisonText(highlights.join(" ")) === description)
  ) {
    return { ...entry, description: "" };
  }

  return entry;
}

/** Keep achievements in their bullets, not repeated as an adjacent paragraph. */
export function normalizeResumeDescriptions(content: ResumeContent): ResumeContent {
  const result = { ...content };

  if (Array.isArray(content.experience)) result.experience = content.experience.map(normalizeEntry);

  if (Array.isArray(content.projects)) result.projects = content.projects.map(normalizeEntry);

  return result;
}
