import { describe, expect, it } from "vite-plus/test";
import { isOngoing, parseYearMonth } from "@/lib/templates/helpers";

describe("template date helpers", () => {
  it.each([
    undefined,
    null,
    "",
    "  ",
    "Present",
    " CURRENT ",
    "Now",
    "Today",
    "ongoing",
    "Jan 2020 - Present",
    "Jan 2020 – Current",
    "2020 — now",
  ])("recognizes an ongoing end date (%s)", (value) => {
    expect(isOngoing(value)).toBe(true);
  });

  it.each([
    "2024-05",
    "unknown",
    "presenter",
    "currently",
    "nowhere",
    "Present - Jan 2024",
    "not current",
  ])("does not treat other text as an ongoing marker (%s)", (value) => {
    expect(isOngoing(value)).toBe(false);
  });

  it.each([
    ["2021-05", { year: 2021, month: 5 }],
    ["2021-05-12", { year: 2021, month: 5 }],
    ["05/2021", { year: 2021, month: 5 }],
    ["May 2021", { year: 2021, month: 5 }],
    [" September 2021 ", { year: 2021, month: 9 }],
    ["2019", { year: 2019, month: null }],
    ["Summer 2020", { year: 2020, month: null }],
    ["2021-13", { year: 2021, month: null }],
    ["00/2021", { year: 2021, month: null }],
    ["Present", null],
    ["", null],
    [null, null],
    [undefined, null],
  ])("places a free-text resume date (%s)", (value, expected) => {
    expect(parseYearMonth(value)).toEqual(expected);
  });
});
