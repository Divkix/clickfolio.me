import { z } from "zod";
import type { JsonValue } from "@/lib/types/json";

/**
 * Normalizes preview skills read from the jsonb column.
 * Trims entries, drops non-string/empty values, and returns an empty array
 * for missing or malformed data.
 */
export function normalizePreviewSkills(raw: JsonValue): string[] {
  const parsed = z.array(z.string()).safeParse(raw);
  if (!parsed.success) return [];

  return parsed.data.map((skill) => skill.trim()).filter((skill) => skill.length > 0);
}
