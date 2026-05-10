/**
 * Safely parse preview skills stored as JSON text.
 * Returns an empty array for invalid/malformed data.
 */
export function parsePreviewSkills(raw: string | null | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const result: string[] = [];
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const skill = item.trim();
      if (skill.length > 0) {
        result.push(skill);
      }
    }
    return result;
  } catch {
    return [];
  }
}
