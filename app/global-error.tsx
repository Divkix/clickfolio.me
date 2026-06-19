"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Global Error Boundary
 * Catches all unhandled errors in the application
 * Provides user-friendly error message and recovery options
 */
/**
 * Global error boundary props for application-wide error handling.
 */
interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global Error Boundary
 * Catches all unhandled errors in the application
 * Provides user-friendly error message and recovery options
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);

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
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            backgroundColor: "#FBFAF9",
            color: "#1B1A18",
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "28rem",
              width: "100%",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E7E3DF",
              borderRadius: "0.75rem",
              boxShadow: "0 1px 2px rgba(27, 26, 24, 0.06)",
              padding: "2rem",
              textAlign: "center",
            }}
          >
            <div style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  margin: "0 auto",
                  width: "4rem",
                  height: "4rem",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(224, 70, 52, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="32"
                  height="32"
                  fill="none"
                  stroke="#E04634"
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

            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
              Something went wrong
            </h1>

            <p style={{ color: "#6B6862", margin: "0 0 1.5rem" }}>
              We encountered an unexpected error. Please try again or go back to the dashboard.
            </p>

            {process.env.NODE_ENV === "development" && (
              <div
                style={{
                  marginBottom: "1.5rem",
                  padding: "1rem",
                  backgroundColor: "#F4F1EE",
                  borderRadius: "0.5rem",
                  textAlign: "left",
                }}
              >
                <p
                  style={{
                    fontSize: "0.75rem",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                    color: "#3A3833",
                    wordBreak: "break-all",
                    margin: 0,
                  }}
                >
                  {error.message}
                </p>
                {error.digest && (
                  <p style={{ fontSize: "0.75rem", color: "#6B6862", margin: "0.5rem 0 0" }}>
                    Error ID: {error.digest}
                  </p>
                )}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  flex: 1,
                  padding: "0.625rem 1rem",
                  backgroundColor: "#E04634",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
              <Link
                href="/dashboard"
                style={{
                  flex: 1,
                  padding: "0.625rem 1rem",
                  backgroundColor: "#FFFFFF",
                  color: "#1B1A18",
                  border: "1px solid #D8D3CD",
                  borderRadius: "0.5rem",
                  fontWeight: 500,
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                Go to Dashboard
              </Link>
            </div>

            <p style={{ marginTop: "1.5rem", fontSize: "0.875rem", color: "#6B6862" }}>
              If the problem persists, please contact support.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
