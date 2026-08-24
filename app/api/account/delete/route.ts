import { eq } from "drizzle-orm";
import { createClerkClient } from "@clerk/backend";
import { z } from "zod";
import { withUser } from "@/lib/auth/with-auth";
import { captureServerEvent } from "@/lib/posthog-server";

import { pendingR2Deletions, resumes, user } from "@/lib/db/schema";
import { getR2Binding, R2 } from "@/lib/r2";
import { deleteAccountSchema } from "@/lib/schemas/account";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";

interface DeletionWarning {
  type: "r2";
  message: string;
}
const clerkErrorSchema = z.object({ status: z.number() });

/** Per-isolate Clerk Backend client (CLERK_SECRET_KEY is stable per isolate). */
let clerkClient: ReturnType<typeof createClerkClient> | null = null;

function getClerkClient(secretKey: string) {
  if (!clerkClient) {
    clerkClient = createClerkClient({ secretKey });
  }
  return clerkClient;
}

/**
 * POST /api/account/delete
 * Permanently deletes a user's account and all associated data
 *
 * GDPR-compliant deletion order:
 * 1. R2 files (resume uploads — must be deleted before DB records)
 * 2. Clerk identity via Backend API — deleting locally first would leave a
 *    survivor identity that re-authenticates into a 404 dead-end; once Clerk
 *    has deleted the user, even a failed local delete is cleaned up by the
 *    `user.deleted` webhook.
 * 3. local Postgres user row (CASCADE handles resumes, siteData,
 *    handleChanges, referralClicks)
 *
 * Session cookies are Clerk-owned: the client signs out via useClerk()
 * after the success response; no app-side cookie surgery here.
 */
export async function POST(request: Request) {
  // Validate request size before parsing (prevent DoS)
  const sizeCheck = validateRequestSize(request);
  if (!sizeCheck.valid) {
    return createErrorResponse(
      sizeCheck.error || "Request body too large",
      ERROR_CODES.BAD_REQUEST,
      413,
    );
  }

  return withUser(
    request,
    async ({ user: authUser, db, dbUser, env }) => {
      const warnings: DeletionWarning[] = [];

      // Get R2 binding for direct operations
      const r2Binding = getR2Binding(env);
      if (!r2Binding) {
        return createErrorResponse(
          "Storage service unavailable",
          ERROR_CODES.EXTERNAL_SERVICE_ERROR,
          500,
        );
      }

      const userId = authUser.id;
      const userEmail = authUser.email;

      // Parse and validate request body (size-capped read, no trust in Content-Length)
      const rawBodyResult = await readJsonWithLimit(request);
      if (!rawBodyResult.ok) {
        return createErrorResponse(
          rawBodyResult.error,
          ERROR_CODES.BAD_REQUEST,
          rawBodyResult.reason === "too_large" ? 413 : 400,
        );
      }
      const body = rawBodyResult.data;

      const parseResult = deleteAccountSchema.safeParse(body);
      if (!parseResult.success) {
        return createErrorResponse(
          "Invalid request data",
          ERROR_CODES.VALIDATION_ERROR,
          400,
          parseResult.error.flatten().fieldErrors,
        );
      }

      const { confirmation } = parseResult.data;

      // Verify email confirmation matches user's email (case-insensitive)
      if (confirmation.toLowerCase() !== userEmail.toLowerCase()) {
        return createErrorResponse(
          "Email confirmation does not match your account email",
          ERROR_CODES.VALIDATION_ERROR,
          400,
        );
      }

      if (!env.CLERK_SECRET_KEY) {
        console.error("CLERK_SECRET_KEY is not configured");
        return createErrorResponse(
          "Account deletion is unavailable due to server misconfiguration",
          ERROR_CODES.INTERNAL_ERROR,
          500,
        );
      }

      // Fetch all resume R2 keys before deletion
      const userResumes = await db
        .select({ r2Key: resumes.r2Key })
        .from(resumes)
        .where(eq(resumes.userId, userId));

      // Delete R2 files in parallel (best effort - continue even if some fail)
      const r2Keys = userResumes.map((r) => r.r2Key).filter((key): key is string => Boolean(key));
      const deletionResults = await Promise.allSettled(
        r2Keys.map((r2Key) => R2.delete(r2Binding, r2Key)),
      );
      const failedKeys: string[] = [];
      deletionResults.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`Failed to delete R2 file ${r2Keys[index]}:`, result.reason);
          warnings.push({
            type: "r2",
            message: `Failed to delete file: ${r2Keys[index]}`,
          });
          failedKeys.push(r2Keys[index]);
        }
      });

      // Durably track failed R2 deletes so the 2 AM cron can retry them.
      // Must happen BEFORE the user row below is removed — after that we'd have
      // no record of which files still need to be purged (GDPR obligation).
      if (failedKeys.length > 0) {
        await db.insert(pendingR2Deletions).values(
          failedKeys.map((key) => ({
            id: crypto.randomUUID(),
            r2Key: key,
            createdAt: new Date().toISOString(),
            attempts: 1,
          })),
        );
      }

      // Delete the Clerk identity first (see docstring ordering rationale).
      try {
        await getClerkClient(env.CLERK_SECRET_KEY).users.deleteUser(dbUser.clerkId);
      } catch (clerkError) {
        // Already gone upstream (e.g. retry after partial failure): proceed to
        // finish the local cleanup instead of stranding the Postgres row.
        const parsedError = clerkErrorSchema.safeParse(clerkError);
        if (!parsedError.success || parsedError.data.status !== 404) {
          console.error("Clerk user deletion error:", clerkError);
          return createErrorResponse(
            "Failed to delete account. Please try again.",
            ERROR_CODES.EXTERNAL_SERVICE_ERROR,
            503,
          );
        }
      }

      // Delete the local user row. A single statement is atomic in Postgres;
      // CASCADE removes resumes, siteData, handleChanges, and referralClicks.
      // The `user.deleted` webhook fired by Clerk performs the same cleanup as
      // a safety net if this step fails after a successful Clerk deletion.
      try {
        await db.delete(user).where(eq(user.id, userId));
      } catch (dbError) {
        console.error("Account deletion error:", dbError);
        return createErrorResponse("Failed to delete account", ERROR_CODES.DATABASE_ERROR, 500);
      }

      // Best-effort analytics — never fails the delete response
      await captureServerEvent(userId, "account_deleted", {
        had_r2_warnings: warnings.length > 0,
      });

      return createSuccessResponse({
        success: true,
        message: "Your account has been permanently deleted",
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    },
    "You must be logged in to delete your account",
  );
}
