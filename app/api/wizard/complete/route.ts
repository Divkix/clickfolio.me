import { Effect } from "effect";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { withUserEffect } from "@/lib/auth/with-auth";
import { logEvent } from "@/lib/utils/log";

import { siteDataContentColumns } from "@/lib/data/site-data-content";
import { handleChanges, siteData, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { Conflict, InvalidInput } from "@/lib/effect/failures";
import { oversizedBodyResponse, readJsonBody } from "@/lib/effect/json-body";
import { isHandleTakenEffect, isValidHandleFormat } from "@/lib/rate-limit/handle-validation";
import { readQuotaIn, requireQuota, type RateLimitResult } from "@/lib/rate-limit/user";
import { buildWizardCompleteSchema } from "@/lib/schemas/profile";
import { THEME_IDS, type ThemeId } from "@/lib/templates/theme-ids";
import type { ResumeContent } from "@/lib/types/database";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";
import { notifyIndexNowForProfiles } from "@/lib/seo/indexnow-runtime";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

// SAFETY: THEME_IDS is non-empty const array of ThemeId strings; spread cast creates required tuple type for zod enum schema.
const wizardCompleteSchema = buildWizardCompleteSchema([...THEME_IDS] as [ThemeId, ...ThemeId[]]);

const PENDING_RESUME_CONTENT: ResumeContent = {
  full_name: "Pending",
  headline: "Resume processing",
  summary: "Resume content is being processed.",
  contact: { email: "" },
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
};

type WizardCompleteOutcome =
  | { kind: "ok"; oldHandle: string | null }
  | { kind: "missing_user" }
  | { kind: "stale" }
  | { kind: "rate_limited"; quota: RateLimitResult; oldHandle: string | null };

export async function POST(request: Request) {
  const oversized = oversizedBodyResponse(request);

  if (oversized) return oversized;

  return withUserEffect(
    request,
    ({ user: authUser }) =>
      Effect.gen(function* () {
        const body = yield* readJsonBody(
          request,
          wizardCompleteSchema,
          "Validation failed. Please check your input.",
        );

        if (!isValidHandleFormat(body.handle)) {
          return yield* Effect.fail(
            new InvalidInput({
              message: "This handle is reserved. Please choose a different one.",
            }),
          );
        }

        const handleTaken = yield* isHandleTakenEffect(authUser.id, body.handle);

        if (handleTaken) {
          return yield* Effect.fail(
            new Conflict({ message: "This handle is already taken. Please choose another." }),
          );
        }

        const currentUserRow = yield* Db.use((db) =>
          db.query("wizard.current-handle", (handle) =>
            handle
              .select({ handle: user.handle })
              .from(user)
              .where(eq(user.id, authUser.id))
              .limit(1),
          ),
        );

        // Compare-and-swap expectation: the handle this request observed before the transaction.
        const expectedHandle = currentUserRow[0]?.handle ?? null;

        const siteDataRow = yield* Db.use((db) =>
          db.query("wizard.site-data-snapshot", (handle) =>
            handle
              .select({ updatedAt: siteData.updatedAt })
              .from(siteData)
              .where(eq(siteData.userId, authUser.id))
              .limit(1),
          ),
        );

        const siteDataSnapshot = siteDataRow[0]?.updatedAt;

        const now = new Date().toISOString();

        // The unique index is the arbiter: a rival that took the handle after the check above
        // makes the transaction fail with a conflict, answered as 409.
        const outcome = yield* Db.use((db) =>
          db.transaction("wizard.complete", async (tx): Promise<WizardCompleteOutcome> => {
            // Row lock serializes concurrent completes for this user (quota count, audit, CAS write).
            const locked = await tx
              .select({ handle: user.handle })
              .from(user)
              .where(eq(user.id, authUser.id))
              .limit(1)
              .for("update");

            if (!locked.length) return { kind: "missing_user" };

            const oldHandle = locked[0].handle;
            const isHandleChange = oldHandle !== body.handle;

            if (isHandleChange) {
              const quota = await readQuotaIn(tx, authUser.id, "handle_change");

              if (!quota.allowed) return { kind: "rate_limited", quota, oldHandle };
            }

            const updated = await tx
              .update(user)
              .set({
                handle: body.handle,
                privacySettings: body.privacy_settings,
                showInDirectory: body.privacy_settings.show_in_directory,
                onboardingCompleted: true,
                updatedAt: now,
              })
              .where(
                and(
                  eq(user.id, authUser.id),
                  expectedHandle === null
                    ? isNull(user.handle)
                    : or(isNull(user.handle), eq(user.handle, expectedHandle)),
                ),
              )
              .returning({ id: user.id });

            if (!updated.length) return { kind: "stale" };

            const conflictUpdate = {
              themeId: body.theme_id,
              lastPublishedAt: now,
              updatedAt: now,
            };

            if (siteDataSnapshot) {
              // Skip when the row moved past the snapshot read at request start (e.g. parse completion published).
              await tx
                .insert(siteData)
                .values({
                  id: crypto.randomUUID(),
                  userId: authUser.id,
                  ...siteDataContentColumns(PENDING_RESUME_CONTENT),
                  themeId: body.theme_id,
                  createdAt: now,
                  updatedAt: now,
                })
                .onConflictDoUpdate({
                  target: siteData.userId,
                  set: conflictUpdate,
                  setWhere: sql`${siteData.updatedAt} <= ${siteDataSnapshot}`,
                });
            } else {
              await tx
                .insert(siteData)
                .values({
                  id: crypto.randomUUID(),
                  userId: authUser.id,
                  ...siteDataContentColumns(PENDING_RESUME_CONTENT),
                  themeId: body.theme_id,
                  createdAt: now,
                  updatedAt: now,
                })
                .onConflictDoUpdate({ target: siteData.userId, set: conflictUpdate });
            }

            if (isHandleChange) {
              await tx.insert(handleChanges).values({
                id: crypto.randomUUID(),
                userId: authUser.id,
                oldHandle,
                newHandle: body.handle,
                createdAt: now,
              });
            }

            return { kind: "ok", oldHandle };
          }),
        ).pipe(
          Effect.catchTag("DbConflict", () =>
            Effect.fail(
              new Conflict({
                message: "This handle was just taken. Please choose a different one.",
              }),
            ),
          ),
        );

        if (outcome.kind === "missing_user") {
          return createErrorResponse("Failed to load profile", ERROR_CODES.DATABASE_ERROR, 500);
        }

        if (outcome.kind === "stale") {
          return yield* Effect.fail(
            new Conflict({
              message: "Your profile was updated elsewhere. Please reload and try again.",
            }),
          );
        }

        if (outcome.kind === "rate_limited") {
          yield* requireQuota(outcome.quota);
        }

        yield* Effect.sync(() => {
          revalidatePublicProfilePages([outcome.oldHandle, body.handle]);
          notifyIndexNowForProfiles([outcome.oldHandle, body.handle], { skipDebounce: true });

          logEvent("onboarding_completed", {
            userId: authUser.id,
            themeId: body.theme_id,
            showInDirectory: body.privacy_settings.show_in_directory,
          });
        });

        return createSuccessResponse({
          success: true,
          handle: body.handle,
        });
      }),
    "You must be logged in to complete onboarding",
  );
}
