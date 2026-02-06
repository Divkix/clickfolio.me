import { eq } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { user } from "@/lib/db/schema";
import { roleUpdateSchema } from "@/lib/schemas/profile";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

/**
 * PUT /api/profile/role
 * Update user's professional level/role
 */
export async function PUT(request: Request) {
  try {
    const {
      user: authUser,
      db,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to update your role");
    if (authError) return authError;

    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse("Invalid JSON in request body", ERROR_CODES.BAD_REQUEST, 400);
    }

    const validation = roleUpdateSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "Invalid role value",
        ERROR_CODES.VALIDATION_ERROR,
        400,
        validation.error.issues,
      );
    }

    await db
      .update(user)
      .set({
        role: validation.data.role,
        roleSource: "user",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(user.id, authUser.id));

    return createSuccessResponse({ role: validation.data.role, roleSource: "user" });
  } catch (err) {
    console.error("Unexpected error in role update:", err);
    return createErrorResponse(
      "An unexpected error occurred. Please try again.",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
