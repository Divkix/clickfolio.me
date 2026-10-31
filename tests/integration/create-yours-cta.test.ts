import { createElement, useRef } from "react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { CreateYoursCTA } from "@/components/CreateYoursCTA";
import { THEME_CHROME } from "@/lib/templates/theme-chrome";
import { renderWithRouter } from "@/tests/helpers/render-with-router";

const { useSession, useEffect, visibility, setVisible } = vi.hoisted(() => ({
  useSession: vi.fn<() => { data: { user: { id: string } } | null }>(),
  useEffect: vi.fn<typeof React.useEffect>(),
  visibility: { value: true },
  setVisible: vi.fn<(visible: boolean) => void>(),
}));

vi.mock("@/lib/auth/client", () => ({ useSession }));

vi.mock("@/hooks/useDismissable", () => ({
  useDismissable: () => [false, () => {}],
}));

// Capture the observer effect without a DOM dependency; the route suite covers real initial SSR.
vi.mock("react", async (importOriginal) => {
  const original = await importOriginal<typeof React>();

  return {
    ...original,
    useState: () => [visibility.value, setVisible],
    useEffect,
    useRef: vi.fn(original.useRef),
  };
});

beforeEach(() => {
  useSession.mockReturnValue({ data: null });
  visibility.value = true;
  useEffect.mockClear();
  setVisible.mockReset();
  setVisible.mockImplementation((visible) => {
    visibility.value = visible;
  });
});

afterEach(() => vi.unstubAllGlobals());

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
    expect(render()).not.toContain("Create yours free");
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

  it("offers an accessible, touch-sized dismissal and an unbroken acquisition link", () => {
    const markup = render();

    expect(markup).toContain('aria-label="Dismiss résumé promotion"');
    expect(markup).toContain("size-11");
    expect(markup).toContain("whitespace-nowrap");
  });

  it("reveals only when the footer sentinel intersects and disconnects on reveal and cleanup", () => {
    visibility.value = false;
    const sentinel = {};
    const observe = vi.fn();
    const disconnect = vi.fn();
    let notify: ((entries: { isIntersecting: boolean }[]) => void) | undefined;

    vi.mocked(useRef).mockReturnValueOnce({ current: sentinel });
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn(function (callback: (entries: { isIntersecting: boolean }[]) => void) {
        notify = callback;

        return { observe, disconnect };
      }),
    );

    expect(render()).not.toContain("Create yours free");
    const setup = useEffect.mock.calls[0]?.[0];

    if (!setup) throw new Error("Promotion did not register its observer effect");

    const cleanup = setup();

    expect(observe).toHaveBeenCalledWith(sentinel);

    if (!notify) throw new Error("Promotion did not create an intersection observer");

    notify([{ isIntersecting: false }]);
    expect(setVisible).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();

    notify([{ isIntersecting: true }]);
    expect(setVisible).toHaveBeenCalledWith(true);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(render()).toContain("Create yours free");

    if (!cleanup) throw new Error("Promotion did not register observer cleanup");

    cleanup();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });
});
