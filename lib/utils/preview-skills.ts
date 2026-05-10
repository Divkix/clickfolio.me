/**
 * Safely parse preview skills stored as JSON text.
 * Returns an empty array for invalid/malformed data.
 */
export function parsePreviewSkills(raw: string | null | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 0);
  } catch {
    return [];
  }
}
