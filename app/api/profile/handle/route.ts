import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { withUserEffect } from "@/lib/auth/with-auth";
import { handleChanges, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { Conflict, InvalidInput, RateLimited } from "@/lib/effect/failures";
import { oversizedBodyResponse, readJsonBody } from "@/lib/effect/json-body";
import { isHandleTakenEffect, isValidHandleFormat } from "@/lib/rate-limit/handle-validation";
import { countHandleChangesInWindow, RATE_LIMITS } from "@/lib/rate-limit/user";
import { handleUpdateSchema } from "@/lib/schemas/profile";
import { notifyIndexNowForProfiles } from "@/lib/seo/indexnow-runtime";
import { logEvent } from "@/lib/utils/log";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

type HandleUpdateOutcome =
  | { kind: "ok"; oldHandle: string | null }
  | { kind: "missing_user" }
  | { kind: "unchanged" }
  | { kind: "rate_limited" };

const HANDLE_TAKEN_MESSAGE = "This handle is already taken. Please choose a different one.";

const HANDLE_JUST_TAKEN_MESSAGE = "This handle was just taken. Please choose a different one.";

export async function PUT(request: Request) {
  const oversized = oversizedBodyResponse(request);

  if (oversized) return oversized;

  return withUserEffect(
    request,
    ({ user: authUser }) =>
      Effect.gen(function* () {
        const { handle: newHandle } = yield* readJsonBody(
          request,
          handleUpdateSchema,
          "Invalid handle format",
        );

        if (!isValidHandleFormat(newHandle)) {
          return yield* Effect.fail(
            new InvalidInput({
              message: "This handle is reserved. Please choose a different one.",
            }),
          );
        }

        const handleTaken = yield* isHandleTakenEffect(authUser.id, newHandle);

        if (handleTaken) {
          return yield* Effect.fail(new Conflict({ message: HANDLE_TAKEN_MESSAGE }));
        }

        const now = new Date().toISOString();

        // The unique index is the arbiter: a rival that took the handle after the check above
        // makes the transaction fail with a conflict, answered as 409.
        const outcome = yield* Db.use((db) =>
          db.transaction("profile.handle.change", async (tx): Promise<HandleUpdateOutcome> => {
            // Row lock serializes quota counting, audit insert, and the write for this user.
            const locked = await tx
              .select({ handle: user.handle })
              .from(user)
              .where(eq(user.id, authUser.id))
              .limit(1)
              .for("update");

            if (!locked.length) return { kind: "missing_user" };

            const oldHandle = locked[0].handle;

            if (oldHandle === newHandle) return { kind: "unchanged" };

            const changesIn24h = await countHandleChangesInWindow(tx, authUser.id);

            if (changesIn24h >= RATE_LIMITS.handle_change.limit) return { kind: "rate_limited" };

            await tx
              .update(user)
              .set({
                handle: newHandle,
                updatedAt: now,
              })
              .where(eq(user.id, authUser.id));

            await tx.insert(handleChanges).values({
              id: crypto.randomUUID(),
              userId: authUser.id,
              oldHandle,
              newHandle,
              createdAt: now,
            });

            return { kind: "ok", oldHandle };
          }),
        ).pipe(
          Effect.catchTag("DbConflict", () =>
            Effect.fail(new Conflict({ message: HANDLE_JUST_TAKEN_MESSAGE })),
          ),
        );

        if (outcome.kind === "missing_user") {
          return createErrorResponse(
            "Failed to fetch current profile",
            ERROR_CODES.DATABASE_ERROR,
            500,
          );
        }

        if (outcome.kind === "unchanged") {
          return yield* Effect.fail(
            new InvalidInput({ message: "Handle is already set to this value" }),
          );
        }

        if (outcome.kind === "rate_limited") {
          return yield* Effect.fail(
            new RateLimited({
              message: `Rate limit exceeded. Maximum ${RATE_LIMITS.handle_change.limit} handle changes per ${RATE_LIMITS.handle_change.windowHours} hours.`,
              // Upper bound: the oldest change in the window frees a slot sooner than this.
              retryAfterSeconds: RATE_LIMITS.handle_change.windowHours * 60 * 60,
            }),
          );
        }

        yield* Effect.sync(() => {
          revalidatePublicProfilePages([outcome.oldHandle, newHandle]);
          notifyIndexNowForProfiles([outcome.oldHandle, newHandle]);

          logEvent("handle_changed", { userId: authUser.id });
        });

        return createSuccessResponse({
          success: true,
          handle: newHandle,
          old_handle: outcome.oldHandle,
        });
      }),
    "You must be logged in to update your handle",
  );
}
