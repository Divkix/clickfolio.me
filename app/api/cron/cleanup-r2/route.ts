/**
 * Cloudflare Cron Trigger handler for R2 storage cleanup (HTTP endpoint)
 *
 * Exists for manual triggers; the scheduled handler in worker/index.ts calls
 * performR2Cleanup() directly to avoid double Worker invocation billing.
 *
 * Scheduled daily at 2 AM UTC via wrangler.jsonc
 * Deletes:
 * - Orphaned temp files in R2 older than 24 hours
 *
 * @returns Response from {@link performR2Cleanup} on success.
 * Returns 401 if cron secret is missing or invalid.
 * Returns 500 on server misconfiguration or cleanup failure.
 */

import { env } from "cloudflare:workers";
import { requireCronAuth } from "@/lib/auth/middleware";
import { performR2Cleanup } from "@/lib/cron/cleanup-r2";
import { getR2Binding } from "@/lib/r2";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

export async function GET(request: Request) {
  const authError = requireCronAuth(request, env);
  if (authError) return authError;

  try {
    const r2Binding = getR2Binding(env);
    if (!r2Binding) {
      return createErrorResponse("R2 bucket not available", ERROR_CODES.INTERNAL_ERROR, 500);
    }

    const result = await performR2Cleanup(r2Binding);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("R2 cleanup cron failed:", error);
    return createErrorResponse("R2 cleanup failed", ERROR_CODES.INTERNAL_ERROR, 500);
  }
}
