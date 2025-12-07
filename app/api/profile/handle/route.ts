import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuthWithMessage } from "@/lib/auth/middleware";
import { handleChanges, user } from "@/lib/db/schema";
import { getSessionDb } from "@/lib/db/session";
import { handleUpdateSchema } from "@/lib/schemas/profile";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { validateRequestSize } from "@/lib/utils/validation";

/**
 * PUT /api/profile/handle
 * Update user's handle (old handle becomes immediately available)
 * Rate limit: 3 handle changes per 24 hours (prevent abuse)
 */
export async function PUT(request: Request) {
  try {
    // 1. Validate request size before parsing (prevent DoS)
    const sizeCheck = validateRequestSize(request);
    if (!sizeCheck.valid) {
      return createErrorResponse(
        sizeCheck.error || "Request body too large",
        ERROR_CODES.BAD_REQUEST,
        413,
      );
    }

    // 2. Authenticate user
    const authResult = await requireAuthWithMessage("You must be logged in to update your handle");
    if (authResult.error) return authResult.error;
    const { user: authUser } = authResult;

    // 3. Get database connection
    const { env } = await getCloudflareContext({ async: true });
    const { db, captureBookmark } = await getSessionDb(env.DB);

    // 4. Check rate limit (3 handle changes per 24 hours)
    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch all handle changes for the user and filter in JS
    const changeCount = await db
      .select({ id: handleChanges.id, createdAt: handleChanges.createdAt })
      .from(handleChanges)
      .where(eq(handleChanges.userId, authUser.id));

    const changesIn24h = changeCount.filter(
      (c) => new Date(c.createdAt) >= new Date(windowStart),
    ).length;

    if (changesIn24h >= 3) {
      return createErrorResponse(
        "Rate limit exceeded. Maximum 3 handle changes per 24 hours.",
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        429,
      );
    }

    // 5. Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse("Invalid JSON in request body", ERROR_CODES.BAD_REQUEST, 400);
    }

    const validation = handleUpdateSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse(
        "Invalid handle format",
        ERROR_CODES.VALIDATION_ERROR,
        400,
        validation.error.issues,
      );
    }

    const { handle: newHandle } = validation.data;

    // 6. Fetch current profile to get old handle
    const currentUser = await db
      .select({ handle: user.handle })
      .from(user)
      .where(eq(user.id, authUser.id))
      .limit(1);

    if (!currentUser.length) {
      return createErrorResponse(
        "Failed to fetch current profile",
        ERROR_CODES.DATABASE_ERROR,
        500,
      );
    }

    const oldHandle = currentUser[0].handle;

    // 7. Check if handle is already the same
    if (oldHandle === newHandle) {
      return createErrorResponse(
        "Handle is already set to this value",
        ERROR_CODES.VALIDATION_ERROR,
        400,
      );
    }

    // 8. Check if new handle is already taken by another user
    const existingUser = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.handle, newHandle), ne(user.id, authUser.id)))
      .limit(1);

    if (existingUser.length > 0) {
      return createErrorResponse(
        "This handle is already taken. Please choose a different one.",
        ERROR_CODES.CONFLICT,
        409,
      );
    }

    // 9. Update handle in user table
    await db
      .update(user)
      .set({
        handle: newHandle,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(user.id, authUser.id));

    // 10. Record the handle change for rate limiting
    await db.insert(handleChanges).values({
      id: crypto.randomUUID(),
      userId: authUser.id,
      oldHandle: oldHandle,
      newHandle: newHandle,
      createdAt: new Date().toISOString(),
    });

    // 11. Invalidate cache for both old and new handles
    if (oldHandle) {
      revalidatePath(`/${oldHandle}`);
    }
    revalidatePath(`/${newHandle}`);

    await captureBookmark();

    return createSuccessResponse({
      success: true,
      handle: newHandle,
      old_handle: oldHandle,
    });
  } catch (err) {
    console.error("Unexpected error in handle update:", err);
    return createErrorResponse(
      "An unexpected error occurred. Please try again.",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
