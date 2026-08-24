import { describe, expect, it } from "vite-plus/test";
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
