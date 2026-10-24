import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";
import { eq } from "drizzle-orm";
import { withUserEffect } from "@/lib/auth/with-auth";
import { user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { upstreamLogFields } from "@/lib/effect/failure-fields";
import { InvalidInput } from "@/lib/effect/failures";
import { oversizedBodyResponse, readJsonBody } from "@/lib/effect/json-body";
import { Clerk } from "@/lib/effect/services/clerk";
import { R2DeleteScheduler } from "@/lib/effect/services/r2-delete-scheduler";
import { R2_DELETE_BATCH_LIMIT, R2Store } from "@/lib/effect/services/r2-store";
import { collectR2KeysForUser } from "@/lib/r2";
import { deleteAccountSchema } from "@/lib/schemas/account";
import { notifyIndexNowForProfiles } from "@/lib/seo/indexnow-runtime";
import type { UnknownRecord } from "@/lib/types/json";
import { errorFields } from "@/lib/utils/error-fields";
import { log, logEvent } from "@/lib/utils/log";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import type { R2DeleteParams } from "@/lib/workflows/r2-delete-params";
import type { AuthenticatedUser } from "@/lib/auth/clerk";

interface DeletionWarning {
  type: "r2" | "cleanup";
  message: string;
}

/** Best-effort: hands deletions to R2DeleteWorkflow, which retries them; a failure is logged. */
function scheduleDeletion(params: R2DeleteParams, what: string) {
  return R2DeleteScheduler.use((scheduler) => scheduler.schedule(params)).pipe(
    Effect.catchTags({
      WorkflowFailed: (failure) =>
        Effect.sync(() => {
          log("error", `failed to schedule R2 ${what}`, { ...upstreamLogFields(failure) });
        }),
      InvalidInput: (failure) =>
        Effect.sync(() => {
          log("error", `failed to schedule R2 ${what}`, { ...errorFields(failure) });
        }),
    }),
  );
}

/**
 * Deletes inline, a batch per call. The keys of a failed batch go to R2DeleteWorkflow (R2
 * deletes are idempotent, so it owns the retries) and are returned.
 */
function deleteInline(keys: readonly string[]) {
  return Effect.gen(function* () {
    const failedKeys: string[] = [];
    const failures: UnknownRecord[] = [];

    for (let start = 0; start < keys.length; start += R2_DELETE_BATCH_LIMIT) {
      const batch = keys.slice(start, start + R2_DELETE_BATCH_LIMIT);

      yield* R2Store.use((store) => store.deleteMany(batch)).pipe(
        Effect.catchTag("R2Failed", (failure) =>
          Effect.sync(() => {
            failedKeys.push(...batch);
            failures.push(upstreamLogFields(failure));
          }),
        ),
      );
    }

    if (failedKeys.length === 0) return failedKeys;

    // Counts, not keys: every key ends in the uploaded file name.
    log("warn", "R2 delete failed; retrying in R2DeleteWorkflow", {
      keyCount: failedKeys.length,
      ...failures[0],
    });

    yield* scheduleDeletion({ keys: failedKeys }, "deletion");

    return failedKeys;
  });
}

function deleteAccount(request: Request, { user: authUser, dbUser }: AuthenticatedUser) {
  return Effect.gen(function* () {
    const warnings: DeletionWarning[] = [];

    const { confirmation } = yield* readJsonBody(
      request,
      deleteAccountSchema,
      "Invalid request data",
    );

    if (confirmation.toLowerCase() !== authUser.email.toLowerCase()) {
      return yield* Effect.fail(
        new InvalidInput({ message: "Email confirmation does not match your account email" }),
      );
    }

    const userId = authUser.id;

    // Delete the Clerk identity first: if this fails, nothing local has changed and the
    // client can retry. A failure after this point is recovered by the user.deleted
    // webhook, which runs the same local cleanup; retrying this route could not work
    // because the local user row (and therefore auth) is already gone.
    yield* Clerk.use((clerk) => clerk.deleteUser(dbUser.clerkId));

    // The cascade removes the resume rows, and the FK stops any new claim from landing
    // for this user while the R2 sweep below runs. Keys must be read before the delete.
    const knownKeys = new Set<string>();
    let deletedLocally = false;

    yield* Db.use((db) =>
      db.transaction("account.delete", async (tx) => {
        for (const key of await collectR2KeysForUser(tx, userId)) knownKeys.add(key);

        await tx.delete(user).where(eq(user.id, userId));
      }),
    ).pipe(
      Effect.map(() => {
        deletedLocally = true;
      }),
      Effect.catchTags({
        DbFailed: (failure) =>
          Effect.sync(() => {
            log("error", "Account deletion error", { ...upstreamLogFields(failure) });
            // The sign-in is already gone, so a retry cannot reach this route; report the
            // pending cleanup instead of a failure the client cannot act on.
            warnings.push({
              type: "cleanup",
              message: "Your sign-in was deleted, but profile data cleanup is still pending.",
            });
          }),
        DbConflict: (failure) =>
          Effect.sync(() => {
            log("error", "Account deletion error", { ...errorFields(failure) });
            warnings.push({
              type: "cleanup",
              message: "Your sign-in was deleted, but profile data cleanup is still pending.",
            });
          }),
      }),
    );

    if (deletedLocally) {
      notifyIndexNowForProfiles([dbUser.handle]);
      revalidatePublicProfilePages([dbUser.handle]);

      // Prefix sweep catches every layout (users/{userId}/{timestamp}/… and
      // users/{userId}/{resumeId}/…) plus objects whose DB row is already gone.
      const prefix = `users/${userId}/`;

      yield* R2Store.use((store) => store.listKeys(prefix)).pipe(
        Effect.map((listed) => {
          for (const key of listed) knownKeys.add(key);
        }),
        Effect.catchTag("R2Failed", (failure) =>
          Effect.gen(function* () {
            log("error", "Failed to list R2 objects for the deleted account", {
              ...upstreamLogFields(failure),
            });
            // The workflow re-lists the prefix with retries, so unlisted objects still go.
            yield* scheduleDeletion({ keys: [], prefix }, "sweep");
          }),
        ),
      );

      // Failed keys retry in R2DeleteWorkflow; the warning tells the caller they are not gone yet.
      const failedKeys = yield* deleteInline([...knownKeys]);

      // A count, not the keys: they end in the uploaded file name.
      if (failedKeys.length > 0) {
        warnings.push({
          type: "r2",
          message: `${failedKeys.length} stored ${failedKeys.length === 1 ? "file" : "files"} could not be deleted yet and will be retried.`,
        });
      }
    }

    logEvent("account_deleted", { userId, hadR2Warnings: warnings.length > 0 });

    return createSuccessResponse({
      success: true,
      message: "Your account has been permanently deleted",
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  });
}

export async function POST(request: Request) {
  const oversized = oversizedBodyResponse(request);

  if (oversized) return oversized;

  return withUserEffect(
    request,
    (authenticated) => {
      // Checked before the irreversible Clerk delete: without the bucket nothing could be swept.
      if (!env.CLICKFOLIO_R2_BUCKET) {
        return Effect.succeed(
          createErrorResponse(
            "Storage service unavailable",
            ERROR_CODES.EXTERNAL_SERVICE_ERROR,
            500,
          ),
        );
      }

      return deleteAccount(request, authenticated).pipe(
        Effect.provide(Layer.mergeAll(R2Store.layer(env), R2DeleteScheduler.layer(env))),
      );
    },
    "You must be logged in to delete your account",
  );
}
