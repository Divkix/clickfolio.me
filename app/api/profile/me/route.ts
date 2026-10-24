import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { withUserEffect } from "@/lib/auth/with-auth";
import { user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { NotFound } from "@/lib/effect/failures";
import { normalizePrivacySettings } from "@/lib/utils/privacy";
import { createSuccessResponse } from "@/lib/utils/security-headers";

export async function GET(request?: Request) {
  return withUserEffect(
    request,
    ({ user: authUser }) =>
      Effect.gen(function* () {
        const userRecord = yield* Db.use((db) =>
          db.query("profile.me", (handle) =>
            handle
              .select({
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                handle: user.handle,
                headline: user.headline,
                privacySettings: user.privacySettings,
                onboardingCompleted: user.onboardingCompleted,
                role: user.role,
                roleSource: user.roleSource,
                isAdmin: user.isAdmin,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
              })
              .from(user)
              .where(eq(user.id, authUser.id))
              .limit(1),
          ),
        );

        const [profile] = userRecord;

        if (!profile) return yield* Effect.fail(new NotFound({ message: "User not found" }));

        return createSuccessResponse({
          ...profile,
          privacySettings: normalizePrivacySettings(profile.privacySettings),
        });
      }),
    "You must be logged in to access your profile",
  );
}
