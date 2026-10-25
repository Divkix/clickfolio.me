import { isNotFound } from "@tanstack/react-router";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { previewPageData } from "@/lib/data/preview-page";
import { DEMO_RESUME_CONTENT } from "@/lib/templates/demo-data";
import { getTemplate } from "@/lib/templates/theme-registry";

describe("/preview/$id", () => {
  it.each(["toString", "constructor", "__proto__", "not-a-theme"])(
    "404s invalid theme %s before reading demo data",
    async (id) => {
      const error = await Promise.resolve()
        .then(() => previewPageData(id))
        .catch((cause: unknown) => cause);

      expect(isNotFound(error)).toBe(true);
    },
  );

  it("loads demo data and chrome for a current theme", async () => {
    const { id, content, profile, chrome } = previewPageData("boardroom");
    const Template = await getTemplate(id);

    const html = renderToStaticMarkup(
      createElement(Template, { content, profile, share: chrome.share }),
    );

    expect(html).toContain(DEMO_RESUME_CONTENT.boardroom.full_name);
    expect(profile.handle).toBe(content.full_name.toLowerCase().replace(/\s+/g, ""));
  });
});
