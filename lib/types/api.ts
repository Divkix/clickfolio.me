/**
 * Shared client-facing types for talking to the app's JSON API routes.
 *
 * Error bodies are produced by `createErrorResponse` in
 * `lib/utils/security-headers.ts`, which always emits `{ error, code, details }`
 * (never `message`). Clients should read `error` for the user-facing string.
 */

/** Error body returned by `createErrorResponse` for any non-OK API response. */
export interface ApiErrorBody {
  error?: string;
  code?: string;
  details?: unknown;
}

/** Response body for POST /api/resume/claim. */
export interface ClaimResponse {
  resume_id: string;
  cached?: boolean;
  error?: string;
}

/** Analytics time window accepted by the analytics API routes. */
export type Period = "7d" | "30d" | "90d";
