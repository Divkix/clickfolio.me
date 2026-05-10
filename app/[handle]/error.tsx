"use client";

import Link from "next/link";
import { useEffect } from "react";
import { siteConfig } from "@/lib/config/site";

/**
 * Public Profile Error Boundary
 * Catches errors in public resume pages
 * Maintains clean, professional branding even in error states
 */
export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Public profile error:", error);

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
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>

        <p className="text-muted-foreground mb-6">
          We couldn&apos;t load this resume. The page may not exist or there was a temporary error.
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
            href="/"
            className="flex-1 px-4 py-2 bg-card text-foreground border border-ink/15 rounded-lg hover:bg-muted transition-colors font-medium text-center"
          >
            Back to Home
          </Link>
        </div>

        <div className="mt-6 pt-6 border-t border-ink/15">
          <p className="text-sm text-muted-foreground">
            Powered by{" "}
            <Link href="/" className="text-foreground hover:underline font-medium">
              {siteConfig.fullName}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
