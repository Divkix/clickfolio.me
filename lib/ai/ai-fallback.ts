/**
 * JSON repair and schema transformation utilities for AI fallback parsing.
 */

import { parsePartialJson } from "ai";

export async function parseJsonWithRepair(
  jsonStr: string,
): Promise<{ data: Record<string, unknown> | null; repaired: boolean }> {
  try {
    return { data: JSON.parse(jsonStr) as Record<string, unknown>, repaired: false };
  } catch {
    const repaired = await parsePartialJson(jsonStr);
    if (!repaired.value || typeof repaired.value !== "object" || Array.isArray(repaired.value)) {
      return { data: null, repaired: false };
    }
    return { data: repaired.value as Record<string, unknown>, repaired: true };
  }
}

/**
 * Transform AI response to match our schema.
 * Handles common mismatches like skills as object vs array.
 */
export function transformToSchema(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };

  // Transform skills from object format to array format
  // AI sometimes returns: { "Design & CAD": ["skill1", "skill2"] }
  // We need: [{ category: "Design & CAD", items: ["skill1", "skill2"] }]
  if (result.skills && typeof result.skills === "object" && !Array.isArray(result.skills)) {
    const skillsObj = result.skills as Record<string, string[]>;
    result.skills = Object.entries(skillsObj).map(([category, items]) => ({
      category,
      items: Array.isArray(items) ? items : [items],
    }));
  }

  // Transform experience descriptions from array to string
  if (Array.isArray(result.experience)) {
    result.experience = (result.experience as Record<string, unknown>[]).map((exp) => {
      if (Array.isArray(exp.description)) {
        return {
          ...exp,
          description: (exp.description as string[]).join(" "),
          highlights: exp.description as string[],
        };
      }
      return exp;
    });
  }

  // Transform project descriptions from array to string
  if (Array.isArray(result.projects)) {
    result.projects = (result.projects as Record<string, unknown>[]).map((proj) => {
      const transformed = { ...proj };
      if (Array.isArray(proj.description)) {
        transformed.description = (proj.description as string[]).join(" ");
      }
      // Rename 'date' to 'year' if present
      if (proj.date && !proj.year) {
        transformed.year = proj.date;
        delete transformed.date;
      }
      return transformed;
    });
  }

  return result;
}
