import { eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
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
export async function GET(request?: Request) {
  return withUser(
    request,
    async ({ user: authUser, db }) => {
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
    },
    "You must be logged in to view stats",
  );
}
