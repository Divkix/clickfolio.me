import { log, logEvent } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import { eq } from "drizzle-orm";
import { createClerkClient } from "@clerk/backend";
import { z } from "zod";
import { withUser } from "@/lib/auth/with-auth";

import { user } from "@/lib/db/schema";
import { collectR2KeysForUser, getR2Binding } from "@/lib/r2";
import { deleteAccountSchema } from "@/lib/schemas/account";
import { notifyIndexNowForProfiles } from "@/lib/seo/indexnow-runtime";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";
import { deleteR2Objects, scheduleR2Deletion } from "@/lib/workflows/r2-delete";

interface DeletionWarning {
  type: "r2" | "cleanup";
  message: string;
}

const clerkErrorSchema = z.object({ status: z.number() });

const R2_SWEEP_PAGE_SIZE = 1000;

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
        log("error", "CLERK_SECRET_KEY is not configured");

        return createErrorResponse(
          "Account deletion is unavailable due to server misconfiguration",
          ERROR_CODES.INTERNAL_ERROR,
          500,
        );
      }

      // Delete the Clerk identity first: if this fails, nothing local has changed and the
      // client can retry. A failure after this point is recovered by the user.deleted
      // webhook, which runs the same local cleanup; retrying this route could not work
      // because the local user row (and therefore auth) is already gone.
      try {
        await getClerkClient(env.CLERK_SECRET_KEY).users.deleteUser(dbUser.clerkId);
      } catch (clerkError) {
        const parsedError = clerkErrorSchema.safeParse(clerkError);

        if (!parsedError.success || parsedError.data.status !== 404) {
          log("error", "Clerk user deletion error:", { ...errorFields(clerkError) });

          return createErrorResponse(
            "Failed to delete account. Please try again.",
            ERROR_CODES.EXTERNAL_SERVICE_ERROR,
            503,
          );
        }
      }

      // The cascade removes the resume rows, and the FK stops any new claim from landing
      // for this user while the R2 sweep below runs. Keys must be read before the delete.
      let knownKeys = new Set<string>();
      let deletedLocally = false;

      try {
        knownKeys = new Set(await collectR2KeysForUser(db, userId));
        await db.delete(user).where(eq(user.id, userId));
        deletedLocally = true;
      } catch (dbError) {
        log("error", "Account deletion error:", { ...errorFields(dbError) });
        // The sign-in is already gone, so a retry cannot reach this route; report the
        // pending cleanup instead of a failure the client cannot act on.
        warnings.push({
          type: "cleanup",
          message: "Your sign-in was deleted, but profile data cleanup is still pending.",
        });
      }

      if (deletedLocally) {
        notifyIndexNowForProfiles([dbUser.handle]);
        revalidatePublicProfilePages([dbUser.handle]);

        // Prefix sweep catches every layout (users/{userId}/{timestamp}/… and
        // users/{userId}/{resumeId}/…) plus objects whose DB row is already gone.
        try {
          let cursor: string | undefined;

          do {
            const page = await r2Binding.list({
              prefix: `users/${userId}/`,
              limit: R2_SWEEP_PAGE_SIZE,
              cursor,
            });

            for (const object of page.objects) knownKeys.add(object.key);
            // SAFETY: R2 listResult with truncated true guarantees cursor presence per R2 API contract; cast narrows to paginated type for next page.
            cursor = page.truncated ? (page as R2Objects & { truncated: true }).cursor : undefined;
          } while (cursor);
        } catch (listError) {
          log("error", `Failed to list R2 objects for ${userId}:`, { ...errorFields(listError) });
          // The workflow re-lists the prefix with retries, so unlisted objects still go.
          await scheduleR2Deletion(env.CLICKFOLIO_R2_DELETE_WORKFLOW, {
            keys: [],
            prefix: `users/${userId}/`,
          }).catch((scheduleError) =>
            log("error", `Failed to schedule R2 sweep for ${userId}:`, {
              ...errorFields(scheduleError),
            }),
          );
        }

        // Failed keys retry in R2DeleteWorkflow; the warning tells the caller they are not gone yet.
        const failedKeys = await deleteR2Objects(r2Binding, env.CLICKFOLIO_R2_DELETE_WORKFLOW, [
          ...knownKeys,
        ]);

        for (const key of failedKeys) {
          warnings.push({ type: "r2", message: `Failed to delete file: ${key}` });
        }
      }

      logEvent("account_deleted", { userId, hadR2Warnings: warnings.length > 0 });

      return createSuccessResponse({
        success: true,
        message: "Your account has been permanently deleted",
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    },
    "You must be logged in to delete your account",
  );
}
