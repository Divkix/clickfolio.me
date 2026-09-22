import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

const analyticsMocks = vi.hoisted(() => ({
  captureAnalyticsError: vi.fn(),
}));

vi.mock("@/lib/analytics/client", () => analyticsMocks);

const originalConsoleError = console.error;

const originalEnv = process.env.NODE_ENV;

import ProtectedError from "@/app/(protected)/error";
import ProfileError from "@/app/[handle]/error";
import ErrorPage from "@/app/error";

describe("Error Boundary Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    Object.assign(process.env, { NODE_ENV: originalEnv });
  });

  describe("Root Error Boundary (app/error.tsx)", () => {
    test("provides retry option that calls reset", () => {
      const error = new Error("Test error");
      const reset = vi.fn();

      render(<ErrorPage error={error} reset={reset} />);

      const tryAgainButton = screen.getByRole("button", { name: /Try Again/i });
      expect(tryAgainButton).toBeInTheDocument();

      tryAgainButton.click();
      expect(reset).toHaveBeenCalledTimes(1);
    });
  });

  describe("Protected Route Error Boundary (app/(protected)/error.tsx)", () => {
    test("reports errors through captureAnalyticsError", async () => {
      const error = new Error("Reportable error");
      error.stack = "Error: Reportable error\n    at TestComponent";
      const reset = vi.fn();

      render(<ProtectedError error={error} reset={reset} />);

      await waitFor(() => {
        expect(analyticsMocks.captureAnalyticsError).toHaveBeenCalledWith(error);
      });
    });
  });

  describe("Handle Route Error Boundary (app/[handle]/error.tsx)", () => {
    test("reports errors through captureAnalyticsError", async () => {
      const error = new Error("Profile page error");
      error.stack = "Error: Profile page error\n    at ProfileComponent";
      const reset = vi.fn();

      render(<ProfileError error={error} reset={reset} />);

      await waitFor(() => {
        expect(analyticsMocks.captureAnalyticsError).toHaveBeenCalledWith(error);
      });
    });
  });

  describe("Error Boundary environment behavior", () => {
    test("shows digest in development but hides message in production", () => {
      Object.assign(process.env, { NODE_ENV: "development" });

      const devError = Object.assign(new Error("Dev mode error"), {
        digest: "error-digest-123",
      });

      const reset = vi.fn();

      const { unmount } = render(<ProtectedError error={devError} reset={reset} />);

      expect(screen.getByText(/Dev mode error/)).toBeInTheDocument();
      expect(screen.getByText(/error-digest-123/)).toBeInTheDocument();

      unmount();

      Object.assign(process.env, { NODE_ENV: "production" });
      const prodError = new Error("Prod mode error");

      render(<ProtectedError error={prodError} reset={reset} />);

      expect(screen.queryByText(/Prod mode error/)).not.toBeInTheDocument();
    });
  });
});
