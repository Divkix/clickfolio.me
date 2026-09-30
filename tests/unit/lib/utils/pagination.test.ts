import { describe, expect, it } from "vite-plus/test";
import { parsePageParam } from "@/lib/utils/pagination";

const pageParamCases: Array<[string | string[] | null | undefined, number | null]> = [
  [undefined, 1],
  [null, 1],
  ["1", 1],
  ["25", 25],
  ["0", null],
  ["-1", null],
  ["2.5", null],
  ["01", null],
  ["abc", null],
  [["2", "3"], null],
  ["9".repeat(400), null],
];

describe("parsePageParam", () => {
  it.each(pageParamCases)("parses %j as %s", (value, expected) => {
    expect(parsePageParam(value)).toBe(expected);
  });
});
