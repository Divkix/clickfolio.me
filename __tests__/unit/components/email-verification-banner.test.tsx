/**
 * EmailVerificationBanner regression test — cooldown interval cleanup.
 *
 * The resend-cooldown setInterval must be cleared on unmount so it cannot
 * keep ticking (and calling setState) after the component is gone.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { EmailVerificationBanner } from "@/components/dashboard/EmailVerificationBanner";

const mocks = vi.hoisted(() => ({
  toast: { error: vi.fn(), success: vi.fn() },
  sendVerificationEmail: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

vi.mock("@/lib/auth/client", () => ({
  sendVerificationEmail: (...args: unknown[]) => mocks.sendVerificationEmail(...args),
}));

describe("EmailVerificationBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.sendVerificationEmail.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears the resend cooldown interval on unmount", async () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    try {
      const { unmount } = render(
        <EmailVerificationBanner
          email="avery@example.com"
          emailVerified={false}
          isOAuthUser={false}
        />,
      );
      expect(screen.getByText("Verify your email")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
      await act(async () => {
        await Promise.resolve();
      });

      expect(mocks.sendVerificationEmail).toHaveBeenCalledWith({
        email: "avery@example.com",
        callbackURL: "/verify-email",
      });
      expect(screen.getByRole("button", { name: "Resend in 60s" })).toBeDisabled();

      // Unmount before the cooldown finishes — the interval must be cleared
      unmount();
      expect(clearIntervalSpy).toHaveBeenCalled();

      // Advancing time after unmount must not fire the leaked interval
      expect(() => {
        act(() => {
          vi.advanceTimersByTime(120_000);
        });
      }).not.toThrow();
    } finally {
      clearIntervalSpy.mockRestore();
    }
  });
});
