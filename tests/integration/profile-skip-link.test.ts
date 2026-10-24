import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import HandlePage from "@/app/[handle]/page";
import { DEMO_RESUME_CONTENT } from "@/lib/templates/demo-data";
import { THEME_IDS, type ThemeId } from "@/lib/templates/theme-ids";

interface ProfileTestState {
  theme: ThemeId;
}

const { state } = vi.hoisted(() => {
  const state: ProfileTestState = { theme: "boardroom" };

  return { state };
});

vi.mock("@/lib/data/resume", () => ({
  getResume: () => ({
    data: {
      content: DEMO_RESUME_CONTENT[state.theme],
      profile: { id: "owner-id", avatar_url: null, handle: "someone" },
      theme_id: state.theme,
      privacy_settings: { hide_from_search: true },
    },
  }),
}));

vi.mock("@/components/CreateYoursCTA", () => ({ CreateYoursCTA: () => null }));

vi.mock("@/components/analytics/OwnerDetector", () => ({ OwnerDetector: () => null }));

describe("public profile skip link", () => {
  it.each(THEME_IDS)(
    "has one shared skip target without nesting main landmarks for %s",
    async (theme) => {
      state.theme = theme;
      const page = await HandlePage({ params: Promise.resolve({ handle: "@someone" }) });
      const html = renderToStaticMarkup(page);
      expect(html.match(/id="main-content"/g)).toHaveLength(1);
      expect(html).toContain('<div id="main-content">');
      expect(html.match(/<main\b/g)?.length ?? 0).toBeLessThanOrEqual(1);
    },
  );
});
