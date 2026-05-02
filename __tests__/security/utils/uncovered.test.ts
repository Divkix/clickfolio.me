import { describe, expect, it } from "vitest";
import { parsePreviewSkills } from "@/lib/utils/preview-skills";
import { escapeXml } from "@/lib/utils/xml";

describe("XML utilities", () => {
  describe("escapeXml", () => {
    it("escapes ampersand (&) to &amp;", () => {
      expect(escapeXml("&")).toBe("&amp;");
      expect(escapeXml("hello & world")).toBe("hello &amp; world");
      expect(escapeXml("a & b & c")).toBe("a &amp; b &amp; c");
    });

    it("escapes less-than (<) to &lt;", () => {
      expect(escapeXml("<")).toBe("&lt;");
      expect(escapeXml("<script>")).toBe("&lt;script&gt;");
      expect(escapeXml("10 < 20")).toBe("10 &lt; 20");
    });

    it("escapes greater-than (>) to &gt;", () => {
      expect(escapeXml(">")).toBe("&gt;");
      expect(escapeXml("> tag")).toBe("&gt; tag");
    });

    it("escapes double quotes to &quot;", () => {
      expect(escapeXml('"')).toBe("&quot;");
      expect(escapeXml('class="foo"')).toBe("class=&quot;foo&quot;");
    });

    it("escapes single quotes to &apos;", () => {
      expect(escapeXml("'")).toBe("&apos;");
      expect(escapeXml("it's working")).toBe("it&apos;s working");
    });

    it("escapes all special characters in one string", () => {
      const input = '<tag attr="value\'s">100 & 200</tag>';
      const expected = "&lt;tag attr=&quot;value&apos;s&quot;&gt;100 &amp; 200&lt;/tag&gt;";
      expect(escapeXml(input)).toBe(expected);
    });

    it("returns empty string for empty input", () => {
      expect(escapeXml("")).toBe("");
    });

    it("handles strings with no special characters", () => {
      expect(escapeXml("hello world")).toBe("hello world");
      expect(escapeXml("normal text 123")).toBe("normal text 123");
    });
  });
});

describe("Preview skills utilities", () => {
  describe("parsePreviewSkills", () => {
    it("returns empty array for null input", () => {
      expect(parsePreviewSkills(null)).toEqual([]);
    });

    it("returns empty array for undefined input", () => {
      expect(parsePreviewSkills(undefined)).toEqual([]);
    });

    it("returns empty array for empty string", () => {
      expect(parsePreviewSkills("")).toEqual([]);
    });

    it("returns empty array for empty JSON array", () => {
      expect(parsePreviewSkills("[]")).toEqual([]);
    });

    it("parses valid JSON array of strings", () => {
      expect(parsePreviewSkills('["React", "TypeScript", "Node.js"]')).toEqual([
        "React",
        "TypeScript",
        "Node.js",
      ]);
    });

    it("trims whitespace from skills", () => {
      expect(parsePreviewSkills('["  React  ", "  TypeScript"]')).toEqual(["React", "TypeScript"]);
    });

    it("filters out empty strings after trimming", () => {
      expect(parsePreviewSkills('["React", "  ", "TypeScript"]')).toEqual(["React", "TypeScript"]);
    });

    it("filters out non-string values", () => {
      expect(parsePreviewSkills('["React", 123, null, true, "TypeScript"]')).toEqual([
        "React",
        "TypeScript",
      ]);
    });

    it("returns empty array for invalid JSON", () => {
      expect(parsePreviewSkills("not json")).toEqual([]);
      expect(parsePreviewSkills("{invalid}")).toEqual([]);
    });

    it("returns empty array for non-array JSON", () => {
      expect(parsePreviewSkills('{"key": "value"}')).toEqual([]);
      expect(parsePreviewSkills('"just a string"')).toEqual([]);
      expect(parsePreviewSkills("123")).toEqual([]);
    });
  });
});
