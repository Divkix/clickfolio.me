import { eq } from "drizzle-orm";
import { createClerkClient } from "@clerk/backend";
import { z } from "zod";
import { withUser } from "@/lib/auth/with-auth";
import { captureServerEvent } from "@/lib/analytics/server";

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

export async function POST(request: Request) {
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

      const userResumes = await db
        .select({ r2Key: resumes.r2Key })
        .from(resumes)
        .where(eq(resumes.userId, userId));

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

      try {
        await getClerkClient(env.CLERK_SECRET_KEY).users.deleteUser(dbUser.clerkId);
      } catch (clerkError) {
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

      try {
        await db.delete(user).where(eq(user.id, userId));
      } catch (dbError) {
        console.error("Account deletion error:", dbError);
        return createErrorResponse("Failed to delete account", ERROR_CODES.DATABASE_ERROR, 500);
      }

      captureServerEvent(userId, "account_deleted", {
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
