import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { OwnerDetector } from "@/components/analytics/OwnerDetector";

const mocks = vi.hoisted(() => ({
  sessionState: {
    current: {
      data: null as { user: { id: string } | null } | null,
      isPending: false,
    },
  },
}));

vi.mock("@/lib/auth/client", () => ({
  useSession: () => mocks.sessionState.current,
}));

describe("OwnerDetector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionState.current = { data: null, isPending: false };
    window.__clickfolioOwner = undefined;
  });

  it("sets the owner flag when the session user matches the profile", () => {
    mocks.sessionState.current = { data: { user: { id: "user_1" } }, isPending: false };
    render(<OwnerDetector profileId="user_1" />);
    expect(window.__clickfolioOwner).toBe(true);
  });

  it("explicitly clears the flag for a non-owner viewing the profile", () => {
    mocks.sessionState.current = { data: { user: { id: "user_1" } }, isPending: false };
    render(<OwnerDetector profileId="user_other" />);
    expect(window.__clickfolioOwner).toBe(false);
  });

  it("treats an anonymous session as a non-owner", () => {
    render(<OwnerDetector profileId="user_1" />);
    expect(window.__clickfolioOwner).toBe(false);
  });

  it("clears the flag on unmount so it cannot leak across page navigations", () => {
    mocks.sessionState.current = { data: { user: { id: "user_1" } }, isPending: false };
    const { unmount } = render(<OwnerDetector profileId="user_1" />);
    expect(window.__clickfolioOwner).toBe(true);

    unmount();
    expect(window.__clickfolioOwner).toBeUndefined();
  });
});
