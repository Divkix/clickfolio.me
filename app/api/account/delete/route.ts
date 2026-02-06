import { eq } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { purgeResumeCache } from "@/lib/cloudflare-cache-purge";
import { getDb } from "@/lib/db";
import {
  account,
  handleChanges,
  resumes,
  session,
  siteData,
  user,
  verification,
} from "@/lib/db/schema";
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
 * 1. R2 files (resume uploads)
 * 2. siteData (has resumeId FK)
 * 3. resumes
 * 4. handleChanges
 * 5. session
 * 6. account
 * 7. verification (by email identifier)
 * 8. user (last)
 */
export async function POST(request: Request) {
  const warnings: DeletionWarning[] = [];

  try {
    // 1. Check authentication and validate user exists in database
    const {
      user: authUser,
      env,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to delete your account");
    if (authError) return authError;

    const typedEnv = env as Partial<CloudflareEnv>;

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

    // 4. Initialize database
    const db = getDb(env.DB);

    // 5. Fetch all resume R2 keys and user handle in parallel before deletion
    const [userResumes, userWithHandle] = await Promise.all([
      db.select({ r2Key: resumes.r2Key }).from(resumes).where(eq(resumes.userId, userId)),
      db.select({ handle: user.handle }).from(user).where(eq(user.id, userId)).limit(1),
    ]);

    const userHandle = userWithHandle[0]?.handle;

    // 6. Delete R2 files in parallel (best effort - continue even if some fail)
    const r2Keys = userResumes.map((r) => r.r2Key).filter((key): key is string => Boolean(key));
    const deletionResults = await Promise.allSettled(
      r2Keys.map((r2Key) => R2.delete(r2Binding, r2Key)),
    );
    deletionResults.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`Failed to delete R2 file ${r2Keys[index]}:`, result.reason);
        warnings.push({
          type: "r2",
          message: `Failed to delete file: ${r2Keys[index]}`,
        });
      }
    });

    // 7. Delete database records in a transaction using batch
    // D1 supports atomic transactions via db.batch() - all operations succeed or all fail
    // This prevents orphaned records if deletion fails midway

    try {
      await db.batch([
        // 7a. Delete siteData (depends on resumeId)
        db.delete(siteData).where(eq(siteData.userId, userId)),
        // 7b. Delete resumes
        db.delete(resumes).where(eq(resumes.userId, userId)),
        // 7c. Delete handleChanges
        db.delete(handleChanges).where(eq(handleChanges.userId, userId)),
        // 7d. Delete sessions (all sessions for this user)
        db.delete(session).where(eq(session.userId, userId)),
        // 7e. Delete accounts (OAuth providers)
        db.delete(account).where(eq(account.userId, userId)),
        // 7f. Delete verification records (by email identifier)
        db.delete(verification).where(eq(verification.identifier, userEmail)),
        // 7g. Delete user (last)
        db.delete(user).where(eq(user.id, userId)),
      ]);

      // Purge edge cache for deleted user's public page (fire-and-forget)
      if (userHandle) {
        const cfZoneId = (typedEnv as CloudflareEnv).CF_ZONE_ID;
        const cfApiToken = (typedEnv as CloudflareEnv).CF_CACHE_PURGE_API_TOKEN;
        const baseUrl = process.env.BETTER_AUTH_URL;

        if (cfZoneId && cfApiToken && baseUrl) {
          // Fire-and-forget: don't block response on cache purge
          purgeResumeCache(userHandle, baseUrl, cfZoneId, cfApiToken).catch(() => {
            // Error already logged inside purgeResumeCache
          });
        }
      }
    } catch (dbError) {
      console.error("Database deletion error:", dbError);
      return createErrorResponse(
        "Failed to delete account data. Please try again or contact support.",
        ERROR_CODES.DATABASE_ERROR,
        500,
        { error: dbError instanceof Error ? dbError.message : "Unknown database error" },
      );
    }

    // 8. Return success response with both cookie variants cleared
    // Clear both cookie names to handle different deployment environments:
    // - "better-auth.session_token" (dev / non-HTTPS)
    // - "__Secure-better-auth.session_token" (production HTTPS with Secure prefix)
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
