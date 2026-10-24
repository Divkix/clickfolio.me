import { createElement } from "react";
import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { CreateYoursCTA } from "@/components/CreateYoursCTA";

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
  return renderToStaticMarkup(
    createElement(CreateYoursCTA, { handle: "someone", profileId: "owner-id" }),
  );
}

describe("portfolio acquisition CTA", () => {
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
});
