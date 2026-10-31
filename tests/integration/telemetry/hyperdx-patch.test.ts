import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { patchHyperdxBrowser } from "@/lib/telemetry/hyperdx-patch";

const installed = readFileSync(
  new URL("../../../node_modules/@hyperdx/browser/build/index.js", import.meta.url),
  "utf8",
);

function serialize(code: string, expression: string): string {
  const start = code.indexOf("function uL(e,t)");
  const end = code.indexOf("const dL=", start);

  return z
    .string()
    .parse(runInNewContext(`${code.slice(start, end)}; JSON.stringify(uL(${expression}, {}))`));
}

describe("HyperDX browser OTLP compatibility", () => {
  it("removes undefined session resource values and nonfinite metrics at the actual SDK emitter", () => {
    const attributes = `{
      get "rum.sessionId"() { return undefined },
      valid: 1,
      invalid: NaN,
      infinite: Infinity,
      array: [1, null, undefined, Infinity, 2],
      nested: { missing: undefined, valid: true }
    }`;

    expect(serialize(installed, attributes)).toContain('"value":{}');
    expect(serialize(installed, attributes)).toContain('"doubleValue":null');
    expect(serialize(patchHyperdxBrowser(installed), attributes)).toBe(
      JSON.stringify([
        { key: "valid", value: { intValue: 1 } },
        { key: "array", value: { arrayValue: { values: [{ intValue: 1 }, { intValue: 2 }] } } },
        {
          key: "nested",
          value: { kvlistValue: { values: [{ key: "valid", value: { boolValue: true } }] } },
        },
      ]),
    );
  });

  it("keeps oversized finite integers as doubles and repairs split UTF-16 strings", () => {
    expect(
      serialize(patchHyperdxBrowser(installed), '{ large: 2 ** 63, label: "split\\uD83D" }'),
    ).toBe(
      JSON.stringify([
        { key: "large", value: { doubleValue: 2 ** 63 } },
        { key: "label", value: { stringValue: "split\uFFFD" } },
      ]),
    );
  });

  it("retains the pagehide flush and requires review when the bundled SDK changes", () => {
    expect(patchHyperdxBrowser(installed)).toContain('addEventListener("pagehide"');
    expect(patchHyperdxBrowser(installed)).not.toContain('addEventListener("unload"');
    expect(() => patchHyperdxBrowser("changed SDK")).toThrow("@hyperdx/browser changed");
  });
});
