/**
 * Generate initials from a full name
 * Example: "John Doe" -> "JD"
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

/**
 * Format a date range for display
 * Example: ("2020-01-01", "2023-06-01") -> "Jan 2020 — Jun 2023"
 * Example: ("2020-01-01", null) -> "Jan 2020 — Present"
 */
export function formatDateRange(startDate: string, endDate?: string | null): string {
  const start = new Date(startDate).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  if (!endDate) return `${start} — Present`;

  const end = new Date(endDate).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return `${start} — ${end}`;
}

/**
 * Flatten skills from categorized structure to simple array
 * Example: [{category: "Frontend", items: ["React", "Vue"]}] -> ["React", "Vue"]
 */
export function flattenSkills(skills?: Array<{ category: string; items: string[] }>): string[] {
  return skills?.flatMap((s) => s.items) || [];
}

/**
 * Format a date string to just the year
 * Example: "2020-01-15" -> "2020"
 */
export function formatYear(date: string): string {
  return new Date(date).getFullYear().toString();
}

/**
 * Format a date string to short month and year
 * Example: "2020-01-15" -> "Jan 2020"
 */
export function formatShortDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
