import { describe, expect, it } from "vite-plus/test";
import { formatDateRange, formatShortDate, formatYear } from "@/lib/templates/helpers";

describe("template date helpers", () => {
  it("formats ISO month dates", () => {
    expect(formatDateRange("2021-03", "2023-11")).toBe("Mar 2021 — Nov 2023");
    expect(formatShortDate("2020-06")).toBe("Jun 2020");
    expect(formatShortDate("2020-06-15")).toBe("Jun 2020");
    expect(formatShortDate("September 2022")).toBe("Sep 2022");
    expect(formatYear("2020-06")).toBe("2020");
    expect(formatYear("May 2018")).toBe("2018");
  });

  it("treats a missing or blank end date as current", () => {
    expect(formatDateRange("2021-03")).toBe("Mar 2021 — Present");
    expect(formatDateRange("2021-03", "  ")).toBe("Mar 2021 — Present");
  });

  it("keeps year-only dates at year precision", () => {
    expect(formatDateRange("2019", "2021")).toBe("2019 — 2021");
    expect(formatYear("2019")).toBe("2019");
  });

  it("shows free-text dates as written instead of Invalid Date", () => {
    expect(formatDateRange("Summer 2020", "Present")).toBe("Summer 2020 — Present");
    expect(formatShortDate("Expected Spring 2027")).toBe("Expected Spring 2027");
    expect(formatYear("Fall 2024")).toBe("Fall 2024");
  });
});
