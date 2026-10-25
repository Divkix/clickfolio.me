import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Route } from "@/app/routes/@{$handle}";
import { DEMO_RESUME_CONTENT } from "@/lib/templates/demo-data";
import { THEME_CHROME } from "@/lib/templates/theme-chrome";
import { THEME_IDS } from "@/lib/templates/theme-ids";
import { getTemplate } from "@/lib/templates/theme-registry";

vi.mock("@/components/CreateYoursCTA", () => ({ CreateYoursCTA: () => null }));

vi.mock("@/components/analytics/OwnerDetector", () => ({ OwnerDetector: () => null }));

vi.mock("@/components/AttributionWidget", () => ({ AttributionWidget: () => null }));

vi.mock("@/components/SharePopover", () => ({ SharePopover: () => null }));

afterEach(() => vi.restoreAllMocks());

describe("public profile skip link", () => {
  it.each(THEME_IDS)(
    "has one shared skip target without nesting main landmarks for %s",
    async (theme) => {
      // As the route loader does, so the markup holds the template rather than its fallback.
      await getTemplate(theme);

      vi.spyOn(Route, "useLoaderData").mockReturnValue({
        handle: "someone",
        metadata: null,
        chrome: THEME_CHROME[theme],
        data: {
          content: DEMO_RESUME_CONTENT[theme],
          profile: { id: "owner-id", avatar_url: null, handle: "someone", headline: null },
          theme_id: theme,
          privacy_settings: {
            hide_from_search: true,
            show_phone: false,
            show_address: false,
            show_in_directory: false,
          },
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      });
      const Component = Route.options.component;

      if (!Component) throw new Error("Profile route has no component");

      const html = renderToStaticMarkup(createElement(Component));

      expect(html.match(/id="main-content"/g)).toHaveLength(1);
      expect(html).toContain('<main id="main-content">');
      expect(html.match(/<main\b/g)).toHaveLength(1);
    },
  );
});
