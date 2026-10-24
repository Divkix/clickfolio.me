import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { withUserEffect } from "@/lib/auth/with-auth";
import { user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { Conflict, NotFound } from "@/lib/effect/failures";
import { oversizedBodyResponse, readJsonBody } from "@/lib/effect/json-body";
import { privacySettingsSchema } from "@/lib/schemas/profile";
import { notifyIndexNowForProfiles } from "@/lib/seo/indexnow-runtime";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";
import { createSuccessResponse } from "@/lib/utils/security-headers";

export async function PUT(request: Request) {
  const oversized = oversizedBodyResponse(request);

  if (oversized) return oversized;

  return withUserEffect(
    request,
    ({ user: authUser, dbUser }) =>
      Effect.gen(function* () {
        const settings = yield* readJsonBody(
          request,
          privacySettingsSchema,
          "Invalid privacy settings data",
        );

        const { show_phone, show_address, hide_from_search, show_in_directory } = settings;

        const privacySettings = {
          show_phone,
          show_address,
          hide_from_search,
          show_in_directory,
        };

        // Version the client loaded; absent means a legacy client, which keeps the unguarded write.
        const expectedUpdatedAt = request.headers.get("If-Unmodified-Since");

        const now = new Date().toISOString();

        // The column and the jsonb flag are one setting: they are written together or not at all.
        const updated = yield* Db.use((db) =>
          db.query("profile.privacy.update", (handle) =>
            handle
              .update(user)
              .set({
                privacySettings,
                showInDirectory: show_in_directory,
                updatedAt: now,
              })
              .where(
                expectedUpdatedAt
                  ? and(eq(user.id, authUser.id), eq(user.updatedAt, expectedUpdatedAt))
                  : eq(user.id, authUser.id),
              )
              .returning({ id: user.id }),
          ),
        );

        if (updated.length === 0) {
          if (expectedUpdatedAt) {
            return yield* Effect.fail(
              new Conflict({ message: "Settings changed elsewhere, reload" }),
            );
          }

          // No row written: never report success or revalidate on stale privacy state.
          return yield* Effect.fail(new NotFound({ message: "User not found" }));
        }

        yield* Effect.sync(() => {
          revalidatePublicProfilePages([dbUser.handle]);
          notifyIndexNowForProfiles([dbUser.handle], { skipDebounce: true });
        });

        return createSuccessResponse({
          success: true,
          updated_at: now,
          privacy_settings: privacySettings,
        });
      }),
    "You must be logged in to update privacy settings",
  );
}
