import { eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
import { user } from "@/lib/db/schema";
import { roleUpdateSchema } from "@/lib/schemas/profile";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";

export async function PUT(request: Request) {
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
    async ({ user: authUser, db }) => {
      const rawBodyResult = await readJsonWithLimit(request);
      if (!rawBodyResult.ok) {
        return createErrorResponse(
          rawBodyResult.error,
          ERROR_CODES.BAD_REQUEST,
          rawBodyResult.reason === "too_large" ? 413 : 400,
        );
      }

      const validation = roleUpdateSchema.safeParse(rawBodyResult.data);
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
    },
    "You must be logged in to update your role",
  );
}
