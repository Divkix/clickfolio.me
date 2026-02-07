"use client";

import Link from "next/link";
import { useEffect } from "react";
import { siteConfig } from "@/lib/config/site";

/**
 * Protected Routes Error Boundary
 * Catches errors in authenticated routes
 * Provides context-aware error handling for dashboard and protected pages
 */
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Protected route error:", error);

    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        url: window.location.href,
      }),
    }).catch(() => {});
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

        <h1 className="text-2xl font-bold text-foreground mb-2">Oops! Something went wrong</h1>

        <p className="text-muted-foreground mb-6">
          We encountered an error while loading this page. Your data is safe.
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
            Back to Dashboard
          </Link>
        </div>

        <div className="mt-6 pt-6 border-t border-ink/15">
          <p className="text-sm text-muted-foreground">
            Need help?{" "}
            <a
              href={`mailto:${siteConfig.supportEmail}`}
              className="text-foreground hover:underline"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
