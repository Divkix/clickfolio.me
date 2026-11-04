import { describe, expect, it } from "vite-plus/test";
import { analyticsTimezoneSchema } from "@/lib/schemas/analytics-timezone";
import { analyticsWindow, dayKey, lastNDays, startOfDay } from "@/lib/utils/date-axis";

describe("analytics calendar dates", () => {
  it("uses the viewer's current date rather than the UTC date", () => {
    const now = Date.parse("2026-01-01T02:00:00Z");

    expect(dayKey(now, "America/Los_Angeles")).toBe("2025-12-31");
    expect(lastNDays(3, "America/Los_Angeles", now)).toEqual([
      "2025-12-29",
      "2025-12-30",
      "2025-12-31",
    ]);
    expect(lastNDays(2, undefined, now)).toEqual(["2025-12-31", "2026-01-01"]);
    expect(analyticsWindow(2, undefined, now)).toEqual({
      startAt: Date.parse("2025-12-31T00:00:00Z"),
      endAt: now,
    });
  });

  it.each([
    ["2026-03-08", "2026-03-09", 23],
    ["2026-11-01", "2026-11-02", 25],
  ])("handles the length of the DST date %s", (date, nextDate, hours) => {
    expect(startOfDay(nextDate, "America/New_York") - startOfDay(date, "America/New_York")).toBe(
      hours * 60 * 60 * 1000,
    );
  });

  it.each([
    ["2026-03-09T16:00:00Z", ["2026-03-07", "2026-03-08", "2026-03-09"], "2026-03-07T05:00:00Z"],
    ["2026-11-02T17:00:00Z", ["2026-10-31", "2026-11-01", "2026-11-02"], "2026-10-31T04:00:00Z"],
  ])("keeps exactly three calendar dates across DST at %s", (instant, dates, start) => {
    const now = Date.parse(instant);

    expect(lastNDays(3, "America/New_York", now)).toEqual(dates);
    expect(analyticsWindow(3, "America/New_York", now)).toEqual({
      startAt: Date.parse(start),
      endAt: now,
    });
  });

  it.each([
    ["Asia/Kathmandu", "2026-01-01T18:30:00Z", "2026-01-02", "2026-01-01T18:15:00Z"],
    ["Pacific/Chatham", "2026-01-01T10:30:00Z", "2026-01-02", "2026-01-01T10:15:00Z"],
    ["America/St_Johns", "2026-01-02T02:30:00Z", "2026-01-01", "2026-01-01T03:30:00Z"],
  ])("uses fractional-hour midnight in %s", (timezone, instant, date, midnight) => {
    const now = Date.parse(instant);

    expect(dayKey(now, timezone)).toBe(date);
    expect(lastNDays(1, timezone, now)).toEqual([date]);
    expect(analyticsWindow(1, timezone, now)).toEqual({
      startAt: Date.parse(midnight),
      endAt: now,
    });
  });

  it.each([
    ["America/Sao_Paulo", "2018-11-04", "2018-11-04T03:00:00Z"],
    ["America/Havana", "2020-11-01", "2020-11-01T04:00:00Z"],
  ])(
    "uses the first instant when midnight is skipped or repeated in %s",
    (timezone, date, instant) => {
      const start = startOfDay(date, timezone);

      expect(start).toBe(Date.parse(instant));
      expect(dayKey(start, timezone)).toBe(date);
      expect(dayKey(start - 1, timezone)).not.toBe(date);
    },
  );
});

describe("analytics timezone boundary", () => {
  it.each([undefined, null, "", "not/a-timezone"])("defaults %s to UTC", (timezone) => {
    expect(analyticsTimezoneSchema.parse(timezone)).toBe("UTC");
  });

  it.each(["UTC", "Asia/Kathmandu", "America/New_York"])("accepts %s", (timezone) => {
    expect(analyticsTimezoneSchema.parse(timezone)).toBe(timezone);
  });
});
