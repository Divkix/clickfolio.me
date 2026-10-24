export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_PATTERNS = MONTHS.map((month) => new RegExp(`\\b${month}`, "i"));

export interface YearMonth {
  year: number;
  month: number | null;
}

// Timeline placement accepts free-text dates even when only the year can be determined.
export function parseYearMonth(raw?: string | null): YearMonth | null {
  const value = raw?.trim();

  if (!value) return null;

  const iso = /^(\d{4})-(\d{1,2})/.exec(value);

  if (iso) {
    const month = Number(iso[2]);

    return { year: Number(iso[1]), month: month >= 1 && month <= 12 ? month : null };
  }

  const slash = /^(\d{1,2})\/(\d{4})$/.exec(value);

  if (slash) {
    const month = Number(slash[1]);

    return { year: Number(slash[2]), month: month >= 1 && month <= 12 ? month : null };
  }

  const year = /\b(19|20)\d{2}\b/.exec(value);

  if (!year) return null;

  const monthIndex = MONTH_PATTERNS.findIndex((pattern) => pattern.test(value));

  return { year: Number(year[0]), month: monthIndex >= 0 ? monthIndex + 1 : null };
}

/** A blank end date or a current marker, alone or at the end of a date range. */
export function isOngoing(end?: string | null): boolean {
  const value = end?.trim();

  return !value || /(?:^|[-–—]\s*)(?:present|current|now|today|ongoing)$/i.test(value);
}

// Resume dates are free text ("2021-03", "Mar 2021", "2019", "Summer 2020"). Only reformat the
// unambiguous shapes; `new Date()` is too lenient (it reads "Summer 2020" as Jan 2020), so
// everything else is shown exactly as written instead of a wrong month or "Invalid Date".
function parseResumeDate(value: string): { month?: string; year: string } | null {
  if (/^\d{4}$/.test(value)) return { year: value };
  const iso = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(value);

  if (iso) {
    const month = MONTHS[Number(iso[2]) - 1];

    return month ? { month, year: iso[1] } : null;
  }

  const named = /^([A-Za-z]{3,9})\.?,? (\d{4})$/.exec(value);
  const month = named && MONTHS.find((m) => named[1].toLowerCase().startsWith(m.toLowerCase()));

  return named && month ? { month, year: named[2] } : null;
}

function formatMonthYear(raw: string): string {
  const value = raw.trim();
  const parsed = parseResumeDate(value);

  if (!parsed) return value;

  return parsed.month ? `${parsed.month} ${parsed.year}` : parsed.year;
}

export function formatDateRange(startDate: string, endDate?: string | null): string {
  const start = formatMonthYear(startDate);

  if (!endDate?.trim()) return `${start} — Present`;

  return `${start} — ${formatMonthYear(endDate)}`;
}

export function flattenSkills(skills?: Array<{ category: string; items: string[] }>): string[] {
  return skills?.flatMap((s) => s.items) || [];
}

export function formatYear(date: string): string {
  const value = date.trim();

  return parseResumeDate(value)?.year ?? value;
}

export function formatShortDate(date: string): string {
  return formatMonthYear(date);
}

/** "Mar 2021 – Present"; tolerates a missing start date and returns null when both are blank. */
export function formatDateSpan(start?: string, end?: string | null): string | null {
  if (!start?.trim()) return end?.trim() ? formatShortDate(end) : null;

  return `${formatShortDate(start)} – ${end?.trim() ? formatShortDate(end) : "Present"}`;
}
