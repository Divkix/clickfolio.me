const DAY_MS = 24 * 60 * 60 * 1000;

function dateFormatter(timezone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    calendar: "iso8601",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDay(instant: number, formatter: Intl.DateTimeFormat): string {
  let year = "";
  let month = "";
  let day = "";

  for (const part of formatter.formatToParts(instant)) {
    switch (part.type) {
      case "year":
        year = part.value;
        break;
      case "month":
        month = part.value;
        break;
      case "day":
        day = part.value;
        break;
    }
  }

  return `${year}-${month}-${day}`;
}

export function dayKey(instant: number, timezone: string): string {
  return formatDay(instant, dateFormatter(timezone));
}

/** First instant of a local date, including dates whose midnight is skipped or repeated. */
export function startOfDay(date: string, timezone: string): number {
  const midnight = Date.parse(`${date}T00:00:00Z`);

  if (timezone === "UTC") return midnight;

  const formatter = dateFormatter(timezone);
  let start = midnight - DAY_MS;
  let end = midnight + DAY_MS;

  // Search calendar labels, not 24-hour durations: DST can change the length of a day.
  while (start < end) {
    const middle = Math.floor((start + end) / 2);

    if (formatDay(middle, formatter) < date) {
      start = middle + 1;
    } else {
      end = middle;
    }
  }

  return start;
}

export function lastNDays(days: number, timezone = "UTC", now = Date.now()): string[] {
  const cursor = new Date(`${dayKey(now, timezone)}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() - days + 1);
  const result: string[] = [];

  for (let i = 0; i < days; i++) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

export function analyticsWindow(days: number, timezone = "UTC", now = Date.now()) {
  const first = new Date(`${dayKey(now, timezone)}T00:00:00Z`);
  first.setUTCDate(first.getUTCDate() - days + 1);

  return { startAt: startOfDay(first.toISOString().slice(0, 10), timezone), endAt: now };
}
