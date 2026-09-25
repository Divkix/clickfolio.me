import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { PostHogIdentifier } from "@/components/PostHogIdentifier";

type UserState = {
  user: { id: string; externalId: string | null; fullName: string | null } | null;
  isLoaded: boolean;
};

const mocks = vi.hoisted(() => {
  const current: UserState = { user: null, isLoaded: true };

  return {
    userState: { current },
    identify: vi.fn(),
    reset: vi.fn(),
  };
});

vi.mock("@/lib/auth/client", () => ({
  useUser: () => mocks.userState.current,
}));

vi.mock("@/lib/analytics/client", () => ({
  isAnalyticsInitialized: () => true,
  identifyAnalyticsUser: mocks.identify,
  resetAnalyticsIdentity: mocks.reset,
}));

const signedIn: UserState = {
  user: { id: "user_clerk", externalId: null, fullName: "Ada Lovelace" },
  isLoaded: true,
};

describe("PostHogIdentifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userState.current = { user: null, isLoaded: true };
  });

  it("does not reset the anonymous identity for a signed-out visitor", () => {
    render(<PostHogIdentifier />);

    expect(mocks.reset).not.toHaveBeenCalled();
    expect(mocks.identify).not.toHaveBeenCalled();
  });

  it("identifies a signed-in user by externalId ?? id", () => {
    mocks.userState.current = signedIn;
    render(<PostHogIdentifier />);

    expect(mocks.identify).toHaveBeenCalledWith("user_clerk", { name: "Ada Lovelace" });
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("resets only when a signed-in user signs out", () => {
    mocks.userState.current = signedIn;
    const { rerender } = render(<PostHogIdentifier />);

    mocks.userState.current = { user: null, isLoaded: true };
    rerender(<PostHogIdentifier />);

    expect(mocks.reset).toHaveBeenCalledTimes(1);
  });

  it("waits for Clerk to load before doing anything", () => {
    mocks.userState.current = { user: null, isLoaded: false };
    render(<PostHogIdentifier />);

    expect(mocks.reset).not.toHaveBeenCalled();
    expect(mocks.identify).not.toHaveBeenCalled();
  });
});
