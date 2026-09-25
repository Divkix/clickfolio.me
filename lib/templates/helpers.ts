export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
