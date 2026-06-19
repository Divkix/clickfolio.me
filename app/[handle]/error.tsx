"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-card rounded-xl shadow-sm border border-border p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" aria-hidden="true" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>

        <p className="text-muted-foreground mb-6">
          We couldn&apos;t load this resume. The page may not exist or there was a temporary error.
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
            <Link href="/">Back to Home</Link>
          </Button>
        </div>

        <div className="mt-6 pt-6 border-t border-border">
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
