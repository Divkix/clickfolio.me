"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Error Boundary for route segments
 * Catches errors within the application and provides recovery options
 * Note: Does not include html/body tags - those are in global-error.tsx
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: globalThis.Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error("Error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="max-w-md w-full bg-card rounded-xl shadow-md border border-ink/10 p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-coral/20 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-coral"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>

        <p className="text-muted-foreground mb-6">
          We encountered an unexpected error. Please try again or go back to the dashboard.
        </p>

        {process.env.NODE_ENV === "development" && (
          <div className="mb-6 p-4 bg-muted rounded-lg text-left">
            <p className="text-xs font-mono text-foreground/80 break-all">{error.message}</p>
            {error.digest && (
              <p className="text-xs text-muted-foreground mt-2">Error ID: {error.digest}</p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={reset}
            className="flex-1 px-4 py-2 bg-linear-to-r from-coral to-coral text-white rounded-lg hover:from-coral/90 hover:to-coral/90 transition-all font-semibold shadow-sm hover:shadow-md"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="flex-1 px-4 py-2 bg-card text-foreground border border-ink/15 rounded-lg hover:bg-muted transition-colors font-medium text-center"
          >
            Go to Dashboard
          </Link>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          If the problem persists, please contact support.
        </p>
      </div>
    </div>
  );
}
