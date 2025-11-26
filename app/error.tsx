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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-depth-md border border-slate-200/60 p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
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

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>

        <p className="text-slate-600 mb-6">
          We encountered an unexpected error. Please try again or go back to the dashboard.
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
            className="flex-1 px-4 py-2 bg-linear-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all font-semibold shadow-depth-sm hover:shadow-depth-md"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="flex-1 px-4 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-medium text-center"
          >
            Go to Dashboard
          </Link>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          If the problem persists, please contact support.
        </p>
      </div>
    </div>
  );
}
