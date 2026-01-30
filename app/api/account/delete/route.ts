import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
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
    // 1. Get Cloudflare env bindings
    const { env } = await getCloudflareContext({ async: true });
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

    // 2. Check authentication
    const auth = await getAuth();
    const sessionData = await auth.api.getSession({ headers: await headers() });

    if (!sessionData?.user) {
      return createErrorResponse(
        "You must be logged in to delete your account",
        ERROR_CODES.UNAUTHORIZED,
        401,
      );
    }

    const userId = sessionData.user.id;
    const userEmail = sessionData.user.email;

    // 3. Parse and validate request body
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

    // 4. Verify email confirmation matches user's email (case-insensitive)
    if (confirmation.toLowerCase() !== userEmail.toLowerCase()) {
      return createErrorResponse(
        "Email confirmation does not match your account email",
        ERROR_CODES.VALIDATION_ERROR,
        400,
      );
    }

    // 5. Initialize database
    const db = getDb(env.DB);

    // 6. Fetch all resume R2 keys before deletion
    const userResumes = await db
      .select({ r2Key: resumes.r2Key })
      .from(resumes)
      .where(eq(resumes.userId, userId));

    // Fetch user's handle BEFORE deletion for cache invalidation
    const userWithHandle = await db
      .select({ handle: user.handle })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const userHandle = userWithHandle[0]?.handle;

    // 7. Delete R2 files in parallel (best effort - continue even if some fail)
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

    // 8. Delete database records in a transaction using batch
    // D1 supports atomic transactions via db.batch() - all operations succeed or all fail
    // This prevents orphaned records if deletion fails midway

    try {
      await db.batch([
        // 8a. Delete siteData (depends on resumeId)
        db
          .delete(siteData)
          .where(eq(siteData.userId, userId)),
        // 8b. Delete resumes
        db
          .delete(resumes)
          .where(eq(resumes.userId, userId)),
        // 8c. Delete handleChanges
        db
          .delete(handleChanges)
          .where(eq(handleChanges.userId, userId)),
        // 8d. Delete sessions (all sessions for this user)
        db
          .delete(session)
          .where(eq(session.userId, userId)),
        // 8e. Delete accounts (OAuth providers)
        db
          .delete(account)
          .where(eq(account.userId, userId)),
        // 8f. Delete verification records (by email identifier)
        db
          .delete(verification)
          .where(eq(verification.identifier, userEmail)),
        // 8g. Delete user (last)
        db
          .delete(user)
          .where(eq(user.id, userId)),
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

    // 9. Return success response with cookie cleared
    // Clear the session cookie to fully log out the user
    const response = createSuccessResponse({
      success: true,
      message: "Your account has been permanently deleted",
      warnings: warnings.length > 0 ? warnings : undefined,
    });

    // Clone the response to add headers (createSuccessResponse returns immutable Response)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        "Set-Cookie":
          "better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
      },
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
