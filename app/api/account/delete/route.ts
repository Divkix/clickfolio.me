import { eq } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";

import { pendingR2Deletions, resumes, user, verification } from "@/lib/db/schema";
import { getR2Binding, R2 } from "@/lib/r2";
import { deleteAccountSchema } from "@/lib/schemas/account";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

interface DeletionWarning {
  type: "r2";
  message: string;
}

/**
 * POST /api/account/delete
 * Permanently deletes a user's account and all associated data
 *
 * GDPR-compliant deletion order:
 * 1. R2 files (resume uploads — must be deleted before DB records)
 * 2. verification (no FK to user — must be explicitly deleted)
 * 3. user (CASCADE handles: session, account, resumes, siteData, handleChanges, referralClicks)
 */
export async function POST(request: Request) {
  const warnings: DeletionWarning[] = [];

  try {
    // 1. Check authentication and validate user exists in database
    const {
      user: authUser,
      db,
      captureBookmark,
      env,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to delete your account");
    if (authError) return authError;

    const typedEnv = env as CloudflareEnv;

    // Get R2 binding for direct operations
    const r2Binding = getR2Binding(typedEnv);
    if (!r2Binding) {
      return createErrorResponse(
        "Storage service unavailable",
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500,
      );
    }

    const userId = authUser.id;
    const userEmail = authUser.email;

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse("Invalid JSON in request body", ERROR_CODES.BAD_REQUEST, 400);
    }

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

    // 3. Verify email confirmation matches user's email (case-insensitive)
    if (confirmation.toLowerCase() !== userEmail.toLowerCase()) {
      return createErrorResponse(
        "Email confirmation does not match your account email",
        ERROR_CODES.VALIDATION_ERROR,
        400,
      );
    }

    // 5. Fetch all resume R2 keys before deletion
    const userResumes = await db
      .select({ r2Key: resumes.r2Key })
      .from(resumes)
      .where(eq(resumes.userId, userId));

    // 6. Delete R2 files in parallel (best effort - continue even if some fail)
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
    // Must happen BEFORE the db.batch() below because that batch removes the user
    // and all cascade-linked rows — after that we'd have no record of which files
    // still need to be purged (GDPR obligation).
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

    // 7. Delete database records in a transaction using batch
    // D1 supports atomic transactions via db.batch() - all operations succeed or all fail
    // This prevents orphaned records if deletion fails midway

    try {
      await db.batch([
        // 7a. Delete verification records (no FK to user — must be explicit)
        db.delete(verification).where(eq(verification.identifier, userEmail)),
        // 7b. Delete user (CASCADE handles: session, account, resumes, siteData, handleChanges, referralClicks)
        db.delete(user).where(eq(user.id, userId)),
      ]);
    } catch (dbError) {
      console.error("Account deletion error:", dbError);
      return createErrorResponse("Failed to delete account", ERROR_CODES.DATABASE_ERROR, 500);
    }

    // 8. Capture session bookmark (write path), then clear cookies in response
    // Clear both cookie names to handle different deployment environments:
    // - "better-auth.session_token" (dev / non-HTTPS)
    // - "__Secure-better-auth.session_token" (production HTTPS with Secure prefix)
    await captureBookmark();
    const response = createSuccessResponse({
      success: true,
      message: "Your account has been permanently deleted",
      warnings: warnings.length > 0 ? warnings : undefined,
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.append(
      "Set-Cookie",
      "better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
    );
    responseHeaders.append(
      "Set-Cookie",
      "__Secure-better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
    );

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Account deletion error:", error);
    return createErrorResponse(
      "An unexpected error occurred while deleting your account",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
