import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Route } from "@/app/routes/@{$handle}";
import { CreateYoursCTA } from "@/components/CreateYoursCTA";
import { DEMO_RESUME_CONTENT } from "@/lib/templates/demo-data";
import { THEME_CHROME } from "@/lib/templates/theme-chrome";
import { THEME_IDS } from "@/lib/templates/theme-ids";
import { getTemplate } from "@/lib/templates/theme-registry";
import { renderWithRouter } from "@/tests/helpers/render-with-router";

const { useSession } = vi.hoisted(() => ({
  useSession: vi.fn<() => { data: { user: { id: string } } | null; isPending: boolean }>(),
}));

vi.mock("@/lib/auth/client", () => ({ useSession }));

vi.mock("@/components/analytics/OwnerDetector", () => ({ OwnerDetector: () => null }));

beforeEach(() => useSession.mockReturnValue({ data: null, isPending: true }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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
            show_email: true,
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

      const html = renderWithRouter(createElement(Component));

      expect(html.match(/id="main-content"/g)).toHaveLength(1);
      expect(html).toContain('<main id="main-content" class="min-h-screen">');
      expect(html.match(/<main\b/g)).toHaveLength(1);

      const footer = html.slice(html.lastIndexOf("</main>") + "</main>".length);

      expect(footer).toMatch(/^<footer class="[^"]*\bprint:hidden\b/);
      expect(footer).toContain("min-h-px");
      expect(footer).not.toContain("Create yours free");
      expect(footer.indexOf("min-h-px")).toBeLessThan(
        footer.indexOf('aria-label="Share this portfolio"'),
      );
      expect(footer).toContain("Built with");
      expect(footer).toContain("flex-wrap");

      const shareTrigger = footer.match(
        /<div class="([^"]*)"><button[^>]*aria-label="Share this portfolio"/,
      )?.[1];

      const attribution = footer.match(/<a\b[^>]*aria-label="Visit [^"]+ homepage"[^>]*>/)?.[0];
      const attributionClasses = attribution?.match(/class="([^"]*)"/)?.[1];

      for (const classes of [shareTrigger, attributionClasses]) {
        expect(classes).toBeDefined();
        const tokens = classes?.split(/\s+/);

        expect(tokens).toContain("relative");
        expect(tokens).not.toContain("fixed");
        expect(tokens).not.toContain("absolute");
      }
    },
  );
});

describe("public promotion hydration", () => {
  it("keeps the empty sentinel identical for new, dismissed, and owner visitors", () => {
    const render = () =>
      renderWithRouter(
        createElement(CreateYoursCTA, {
          handle: "someone",
          profileId: "owner-id",
          styles: THEME_CHROME.minimalist_editorial.cta,
        }),
      );

    const initial = render();

    expect(initial).toContain("min-h-px");
    expect(initial).not.toContain("Create yours free");

    vi.stubGlobal("localStorage", { getItem: () => Date.now().toString() });
    expect(render()).toBe(initial);

    useSession.mockReturnValue({ data: { user: { id: "owner-id" } }, isPending: false });
    expect(render()).toBe(initial);
  });
});
