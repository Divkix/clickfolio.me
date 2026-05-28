import { eq } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { user } from "@/lib/db/schema";

import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

/**
 * GET /api/user/stats
 *
 * Returns the current user's stats including referral count and pro status.
 * Used by the wizard and other client components that need this data.
 *
 * Response:
 *   { referralCount: number, isPro: boolean }
 *
 * Error codes:
 *   - 404: user not found
 *   - 500: unexpected error
 */
export async function GET() {
  try {
    // Check authentication and validate user exists in database
    const {
      user: authUser,
      db,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to view stats");
    if (authError) return authError;

    const userData = await db.query.user.findFirst({
      where: eq(user.id, authUser.id),
      columns: {
        referralCount: true,
        isPro: true,
      },
    });

    if (!userData) {
      return createErrorResponse("User not found", ERROR_CODES.NOT_FOUND, 404);
    }

    return createSuccessResponse({
      referralCount: userData.referralCount ?? 0,
      isPro: userData.isPro ?? false,
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return createErrorResponse("Internal server error", ERROR_CODES.INTERNAL_ERROR, 500);
  }
}
