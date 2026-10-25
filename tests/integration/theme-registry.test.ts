import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { THEME_CHROME } from "@/lib/templates/theme-chrome";
import type { ThemeId } from "@/lib/templates/theme-ids";
import { getTemplate, TEMPLATE_LOADERS, ThemeTemplate } from "@/lib/templates/theme-registry";
import type { TemplateProps } from "@/lib/types/template";

const FALLBACK =
  '<div class="min-h-screen flex items-center justify-center"><div class="animate-pulse text-slate-400">Loading template...</div></div>';

const Fake: FC<TemplateProps> = ({ content, profile }) =>
  createElement("div", null, `${content.full_name}:${profile.handle}`);

function preview(themeId: ThemeId) {
  return createElement(ThemeTemplate, {
    themeId,
    content: {
      full_name: "Template Person",
      headline: "Designer",
      summary: "A template preview.",
      contact: { email: "" },
      experience: [],
    },
    profile: { avatar_url: null, handle: "preview-handle" },
    share: THEME_CHROME[themeId].share,
  });
}

afterEach(() => vi.restoreAllMocks());

describe("ThemeTemplate", () => {
  it("renders a template its route loader already loaded in place, without a fallback", async () => {
    const loader = vi.spyOn(TEMPLATE_LOADERS, "boardroom").mockResolvedValue(Fake);

    await getTemplate("boardroom");

    expect(renderToStaticMarkup(preview("boardroom"))).toBe(
      "<div>Template Person:preview-handle</div>",
    );
    expect(loader).toHaveBeenCalledOnce();
  });

  it("shows the fallback until a template that was not preloaded arrives", async () => {
    const { promise, resolve } = Promise.withResolvers<FC<TemplateProps>>();
    const loader = vi.spyOn(TEMPLATE_LOADERS, "midnight").mockReturnValue(promise);

    expect(renderToStaticMarkup(preview("midnight"))).toBe(FALLBACK);

    resolve(Fake);

    await vi.waitFor(() => {
      expect(renderToStaticMarkup(preview("midnight"))).toBe(
        "<div>Template Person:preview-handle</div>",
      );
    });
    expect(loader).toHaveBeenCalledOnce();
  });

  it("loads a template again after a failed load", async () => {
    const loader = vi
      .spyOn(TEMPLATE_LOADERS, "glass")
      .mockRejectedValueOnce(new Error("chunk failed"))
      .mockResolvedValueOnce(Fake);

    await expect(getTemplate("glass")).rejects.toThrow("chunk failed");
    await expect(getTemplate("glass")).resolves.toBe(Fake);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
