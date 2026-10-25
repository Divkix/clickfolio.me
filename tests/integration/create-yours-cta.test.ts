import { createElement } from "react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { CreateYoursCTA } from "@/components/CreateYoursCTA";
import { THEME_CHROME } from "@/lib/templates/theme-chrome";
import { renderWithRouter } from "@/tests/helpers/render-with-router";

const { useSession } = vi.hoisted(() => ({
  useSession: vi.fn<() => { data: { user: { id: string } } | null }>(),
}));

vi.mock("@/lib/auth/client", () => ({ useSession }));

vi.mock("@/hooks/useDismissable", () => ({
  useDismissable: () => [false, () => {}],
}));

// Render the CTA after its delay without a DOM or real timers.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  useState: () => [true, () => {}],
}));

beforeEach(() => {
  useSession.mockReturnValue({ data: null });
});

function render() {
  return renderWithRouter(
    createElement(CreateYoursCTA, {
      handle: "someone",
      profileId: "owner-id",
      styles: THEME_CHROME.minimalist_editorial.cta,
    }),
  );
}

describe("portfolio acquisition CTA", () => {
  it.each(Object.values(THEME_CHROME))("renders server-resolved CTA classes", ({ cta: styles }) => {
    const markup = renderWithRouter(
      createElement(CreateYoursCTA, { handle: "someone", profileId: "owner-id", styles }),
    );

    for (const classes of Object.values(styles)) {
      expect(markup).toContain(classes);
    }
  });
  it("hides for the owner using the public profile identity, without a session handle", () => {
    useSession.mockReturnValue({ data: { user: { id: "owner-id" } } });
    expect(render()).toBe("");
  });

  it("shows for another signed-in visitor", () => {
    useSession.mockReturnValue({ data: { user: { id: "other-id" } } });
    expect(render()).toContain("Create yours free");
  });

  it("shows for a signed-out visitor", () => {
    expect(render()).toContain("Create yours free");
  });

  it("links home with the profile's UTM campaign", () => {
    expect(render()).toContain(
      'href="/?utm_source=resume&amp;utm_medium=cta&amp;utm_campaign=someone"',
    );
  });
});
