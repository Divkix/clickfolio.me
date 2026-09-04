import type { UnknownRecord } from "@/lib/types/json";
import { parsePartialJson } from "ai";

export async function parseJsonWithRepair(
  jsonStr: string,
): Promise<{ data: UnknownRecord | null; repaired: boolean }> {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed === null || Array.isArray(parsed) || !(parsed instanceof Object)) {
      return { data: null, repaired: false };
    }
    // SAFETY: null and object guard above ensures parsed is a non-null non-array object; UnknownRecord is the safe JSON object type for AI repair handling.
    return { data: parsed as UnknownRecord, repaired: false };
  } catch {
    const repaired = await parsePartialJson(jsonStr);
    if (!repaired.value || Array.isArray(repaired.value) || !(repaired.value instanceof Object)) {
      return { data: null, repaired: false };
    }
    // SAFETY: null and object guard above ensures repaired.value is a non-null non-array object; UnknownRecord is the safe JSON object type for AI repair handling.
    return { data: repaired.value as UnknownRecord, repaired: true };
  }
}

export function transformToSchema(data: UnknownRecord): UnknownRecord {
  const result = { ...data };

  if (result.skills && result.skills instanceof Object && !Array.isArray(result.skills)) {
    // SAFETY: object and Array.isArray guard above ensures result.skills is a plain object; Record<string,string[]> is safe for AI skill-category map transformation.
    const skillsObj = result.skills as Record<string, string[]>;
    result.skills = Object.entries(skillsObj).map(([category, items]) => ({
      category,
      items: Array.isArray(items) ? items : [items],
    }));
  }

  if (Array.isArray(result.experience)) {
    // SAFETY: Array.isArray guard above ensures result.experience is an array; UnknownRecord[] is the safe type for mapping AI experience entries.
    result.experience = (result.experience as UnknownRecord[]).map((exp) => {
      if (Array.isArray(exp.description)) {
        return {
          ...exp,
          // SAFETY: Array.isArray guard above ensures exp.description is a string array.
          description: (exp.description as string[]).join(" "),
          // SAFETY: Array.isArray guard above ensures exp.description is a string array.
          highlights: exp.description as string[],
        };
      }
      return exp;
    });
  }

  if (Array.isArray(result.projects)) {
    // SAFETY: Array.isArray guard above ensures result.projects is an array; UnknownRecord[] is the safe type for mapping AI project entries.
    result.projects = (result.projects as UnknownRecord[]).map((proj) => {
      const transformed = { ...proj };
      if (Array.isArray(proj.description)) {
        // SAFETY: Array.isArray guard above ensures proj.description is a string array.
        transformed.description = (proj.description as string[]).join(" ");
      }
      if (proj.date && !proj.year) {
        transformed.year = proj.date;
        delete transformed.date;
      }
      return transformed;
    });
  }
  return result;
}
