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

    // TODO: Log to monitoring service
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-depth-md border border-slate-200/60 p-8 text-center">
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

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>

        <p className="text-slate-600 mb-6">
          We couldn&apos;t load this resume. The page may not exist or there was a temporary error.
        </p>

        {process.env.NODE_ENV === "development" && (
          <div className="mb-6 p-4 bg-slate-50 rounded-lg text-left">
            <p className="text-xs font-mono text-slate-700 break-all">{error.message}</p>
            {error.digest && (
              <p className="text-xs text-slate-500 mt-2">Error ID: {error.digest}</p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={reset}
            className="flex-1 px-4 py-2 bg-linear-to-r from-coral to-coral text-white rounded-lg hover:from-coral/90 hover:to-coral/90 transition-all font-semibold shadow-depth-sm hover:shadow-depth-md"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="flex-1 px-4 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-medium text-center"
          >
            Back to Home
          </Link>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            Powered by{" "}
            <Link href="/" className="text-slate-900 hover:underline font-medium">
              {siteConfig.fullName}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
