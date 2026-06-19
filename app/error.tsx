"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Error Boundary for route segments
 * Catches errors within the application and provides recovery options
 * Note: Does not include html/body tags - those are in global-error.tsx
 */
/**
 * Error boundary props for route-level error handling.
 */
interface ErrorPageProps {
  error: globalThis.Error & { digest?: string };
  reset: () => void;
}

/**
 * Error Boundary for route segments
 * Catches errors within the application and provides recovery options
 * Note: Does not include html/body tags - those are in global-error.tsx
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log error to console for debugging
    console.error("Error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-card rounded-xl shadow-sm border border-border p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" aria-hidden="true" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>

        <p className="text-muted-foreground mb-6">
          We encountered an unexpected error. Please try again or go back to the dashboard.
        </p>

        {process.env.NODE_ENV === "development" && (
          <div className="mb-6 p-4 bg-surface-2 rounded-lg text-left">
            <p className="text-xs font-mono text-foreground/80 break-all">{error.message}</p>
            {error.digest && (
              <p className="text-xs text-muted-foreground mt-2">Error ID: {error.digest}</p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button type="button" onClick={reset} className="flex-1">
            Try Again
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          If the problem persists, please contact support.
        </p>
      </div>
    </div>
  );
}
