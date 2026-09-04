export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

export function formatDateRange(startDate: string, endDate?: string | null): string {
  const start = new Date(startDate).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  if (!endDate) return `${start} — Present`;

  const end = new Date(endDate).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return `${start} — ${end}`;
}

export function flattenSkills(skills?: Array<{ category: string; items: string[] }>): string[] {
  return skills?.flatMap((s) => s.items) || [];
}

export function formatYear(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" });
}

export function formatShortDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
