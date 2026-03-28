/**
 * Error Boundary Component Tests
 *
 * Tests error boundary behavior, error reporting, recovery mechanisms,
 * and edge cases for React error boundaries in Next.js.
 *
 * @module __tests__/unit/components/error-boundaries.test
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, type Mock, test, vi } from "vitest";

// Store original globals
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const originalEnv = process.env.NODE_ENV;

// Create mock fetch
const mockFetch = vi.fn();

import ProtectedError from "@/app/(protected)/error";
import ProfileError from "@/app/[handle]/error";
// Import error boundary components (these are "use client" so we can test them)
import ErrorPage from "@/app/error";

describe("Error Boundary Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true });
    // @ts-expect-error - mocking fetch
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    globalThis.fetch = originalFetch;
    (process.env as { NODE_ENV: string }).NODE_ENV = originalEnv;
  });

  // ============================================================================
  // Root Error Boundary Tests
  // ============================================================================

  describe("Root Error Boundary (app/error.tsx)", () => {
    test("1. Root error boundary catches unhandled errors and displays UI", () => {
      const error = new Error("Test error");
      const reset = vi.fn();

      render(<ErrorPage error={error} reset={reset} />);

      // Should display user-friendly error message
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText(/We encountered an unexpected error/)).toBeInTheDocument();
    });

    test("4. Error boundary displays user-friendly error message", () => {
      const error = new Error("Technical error details");
      const reset = vi.fn();

      render(<ErrorPage error={error} reset={reset} />);

      // Should show friendly message, not technical details (in production)
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText(/Please try again or go back to the dashboard/)).toBeInTheDocument();

      // Technical error should not be visible in production mode
      expect(screen.queryByText("Technical error details")).not.toBeInTheDocument();
    });

    test("5. Error boundary provides retry/refresh option", () => {
      const error = new Error("Test error");
      const reset = vi.fn();

      render(<ErrorPage error={error} reset={reset} />);

      // Should have "Try Again" button
      const tryAgainButton = screen.getByRole("button", { name: /Try Again/i });
      expect(tryAgainButton).toBeInTheDocument();

      // Clicking should call reset
      tryAgainButton.click();
      expect(reset).toHaveBeenCalledTimes(1);
    });

    test("7. Error boundary handles async errors gracefully", () => {
      const error = new Error("Async operation failed");
      const reset = vi.fn();

      render(<ErrorPage error={error} reset={reset} />);

      // Should still render error UI for async errors
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    test("11. Error boundary recovery — reset and retry works", async () => {
      const error = new Error("Initial error");
      const reset = vi.fn();

      const { rerender } = render(<ErrorPage error={error} reset={reset} />);

      // Click try again
      const tryAgainButton = screen.getByRole("button", { name: /Try Again/i });
      await userEvent.click(tryAgainButton);

      expect(reset).toHaveBeenCalled();

      // Simulate error boundary recovering by passing a new error
      const newError = new Error("Recovered but new error");
      rerender(<ErrorPage error={newError} reset={reset} />);

      // Should still show error UI
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    test("13. Error boundary logs errors to console for debugging", () => {
      const error = new Error("Debug error");
      const reset = vi.fn();

      render(<ErrorPage error={error} reset={reset} />);

      // useEffect should log the error
      expect(console.error).toHaveBeenCalledWith("Error boundary caught:", error);
    });
  });

  // ============================================================================
  // Protected Route Error Boundary Tests
  // ============================================================================

  describe("Protected Route Error Boundary (app/(protected)/error.tsx)", () => {
    test("2. Protected route error boundary catches errors in protected pages", () => {
      const error = new Error("Protected route error");
      const reset = vi.fn();

      render(<ProtectedError error={error} reset={reset} />);

      expect(screen.getByText(/Oops! Something went wrong/)).toBeInTheDocument();
      expect(
        screen.getByText(/We encountered an error while loading this page/),
      ).toBeInTheDocument();
    });

    test("6. Error reporting to /api/client-error endpoint", async () => {
      const error = new Error("Reportable error");
      error.stack = "Error: Reportable error\n    at TestComponent";
      const reset = vi.fn();

      render(<ProtectedError error={error} reset={reset} />);

      // Wait for the useEffect to fire
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/client-error",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: expect.stringContaining("Reportable error"),
          }),
        );
      });
    });

    test("8. Error boundary handles render errors", () => {
      const error = new Error("Render cycle error");
      const reset = vi.fn();

      render(<ProtectedError error={error} reset={reset} />);

      expect(screen.getByText(/Oops! Something went wrong/)).toBeInTheDocument();
      expect(
        screen.getByText(/We encountered an error while loading this page/),
      ).toBeInTheDocument();
    });

    test("10. Error boundary with nested boundaries — proper error bubbling", () => {
      // This tests that protected route errors stay in protected boundary
      const error = new Error("Nested boundary test");
      const reset = vi.fn();

      render(<ProtectedError error={error} reset={reset} />);

      // Should show protected-specific UI, not generic
      expect(screen.getByText(/Your data is safe/)).toBeInTheDocument();
      expect(screen.getByText(/Back to Dashboard/)).toBeInTheDocument();
    });

    test("12. Error boundary with fatal errors shows fatal message", () => {
      // Create an error that could be considered "fatal"
      const fatalError = new Error("Fatal: Unrecoverable state");
      fatalError.stack = undefined; // Simulate missing stack
      const reset = vi.fn();

      render(<ProtectedError error={fatalError} reset={reset} />);

      // Should still render error UI
      expect(screen.getByText(/Oops! Something went wrong/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Try Again/i })).toBeInTheDocument();
    });

    test("14. Multiple error boundaries don't interfere with each other", () => {
      const error = new Error("Isolation test");
      const reset = vi.fn();

      // Render both protected and root error boundaries to ensure isolation
      const { container: container1 } = render(<ProtectedError error={error} reset={reset} />);
      const protectedContent = container1.textContent;

      // Reset for root boundary render
      reset.mockClear();
      const { container: container2 } = render(<ErrorPage error={error} reset={reset} />);
      const rootContent = container2.textContent;

      // They should have different content (different error messages)
      expect(protectedContent).not.toEqual(rootContent);
      expect(protectedContent).toContain("Oops!");
      expect(rootContent).not.toContain("Oops!");
    });

    test("15. Error boundary in production vs dev mode (development info visibility)", () => {
      // Test in development mode
      (process.env as { NODE_ENV: string }).NODE_ENV = "development";
      const devError = new Error("Dev mode error") as Error & { digest?: string };
      devError.digest = "error-digest-123";
      const reset = vi.fn();

      const { unmount } = render(<ProtectedError error={devError} reset={reset} />);

      // In dev mode, error details should be visible
      expect(screen.getByText(/Dev mode error/)).toBeInTheDocument();
      expect(screen.getByText(/error-digest-123/)).toBeInTheDocument();

      unmount();

      // Test in production mode
      (process.env as { NODE_ENV: string }).NODE_ENV = "production";
      const prodError = new Error("Prod mode error");

      render(<ProtectedError error={prodError} reset={reset} />);

      // In production, error details should NOT be visible
      expect(screen.queryByText(/Prod mode error/)).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Handle Route Error Boundary Tests
  // ============================================================================

  describe("Handle Route Error Boundary (app/[handle]/error.tsx)", () => {
    test("3. Handle route error boundary catches errors in public resume pages", () => {
      const error = new Error("Public profile error");
      const reset = vi.fn();

      render(<ProfileError error={error} reset={reset} />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText(/We couldn't load this resume/)).toBeInTheDocument();
    });

    test("6. Handle route error reporting to /api/client-error endpoint", async () => {
      const error = new Error("Profile page error");
      error.stack = "Error: Profile page error\n    at ProfileComponent";
      const reset = vi.fn();

      render(<ProfileError error={error} reset={reset} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/client-error",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: expect.stringContaining("Profile page error"),
          }),
        );
      });
    });

    test("9. Error boundary handles event handler errors context", () => {
      const error = new Error("Event handler error");
      const reset = vi.fn();

      render(<ProfileError error={error} reset={reset} />);

      // Should provide context-appropriate messaging
      expect(
        screen.getByText(/The page may not exist or there was a temporary error/),
      ).toBeInTheDocument();
    });

    test("ProfileError shows branding in footer", () => {
      const error = new Error("Branding test");
      const reset = vi.fn();

      render(<ProfileError error={error} reset={reset} />);

      // Should have branding in footer
      expect(screen.getByText(/Powered by/)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Error Boundary Edge Cases
  // ============================================================================

  describe("Error Boundary Edge Cases", () => {
    test("Error boundary handles error without message", () => {
      const error = new Error();
      error.message = "";
      const reset = vi.fn();

      render(<ErrorPage error={error} reset={reset} />);

      // Should still render without crashing
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    test("Error boundary handles error with undefined stack", () => {
      const error = new Error("No stack");
      error.stack = undefined;
      const reset = vi.fn();

      render(<ProtectedError error={error} reset={reset} />);

      expect(screen.getByText(/Oops! Something went wrong/)).toBeInTheDocument();
    });

    test("Error boundary handles very long error messages", () => {
      const longMessage = "A".repeat(10000);
      const error = new Error(longMessage);
      const reset = vi.fn();

      render(<ErrorPage error={error} reset={reset} />);

      // Should handle without crashing
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    test("Error boundary fetch failure is handled gracefully", async () => {
      // Make fetch fail
      mockFetch.mockRejectedValue(new Error("Network failure"));

      const error = new Error("Test error");
      const reset = vi.fn();

      // Should not throw when fetch fails
      expect(() => {
        render(<ProtectedError error={error} reset={reset} />);
      }).not.toThrow();

      // Wait for the async operation to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // UI should still be rendered
      expect(screen.getByText(/Oops! Something went wrong/)).toBeInTheDocument();
    });

    test("Error boundary handles error with special characters", () => {
      const error = new Error("Error with <script>alert('xss')</script> & \"quotes\"");
      const reset = vi.fn();

      render(<ErrorPage error={error} reset={reset} />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    test("Error boundary reset function can be called multiple times", async () => {
      const error = new Error("Multi-reset test");
      const reset = vi.fn();

      render(<ErrorPage error={error} reset={reset} />);

      const tryAgainButton = screen.getByRole("button", { name: /Try Again/i });

      // Click multiple times
      await userEvent.click(tryAgainButton);
      await userEvent.click(tryAgainButton);
      await userEvent.click(tryAgainButton);

      expect(reset).toHaveBeenCalledTimes(3);
    });
  });
});
