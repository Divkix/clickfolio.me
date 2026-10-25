import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { withUserEffect } from "@/lib/auth/with-auth";
import { user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { oversizedBodyResponse, readJsonBody } from "@/lib/effect/json-body";
import { roleUpdateSchema } from "@/lib/schemas/profile";
import { createSuccessResponse } from "@/lib/utils/security-headers";

export const Route = createFileRoute("/api/profile/role")({
  server: {
    handlers: {
      PUT: async ({ request }) => {
        const oversized = oversizedBodyResponse(request);

        if (oversized) return oversized;

        return withUserEffect(
          request,
          ({ user: authUser }) =>
            Effect.gen(function* () {
              const update = yield* readJsonBody(request, roleUpdateSchema, "Invalid role value");
              const { role, isFreelance } = update;

              const changes: Partial<typeof user.$inferInsert> = {
                updatedAt: new Date().toISOString(),
              };

              if (role) {
                changes.role = role;
                changes.roleSource = "user";
              }

              if (isFreelance !== undefined) changes.isFreelance = isFreelance;

              yield* Db.use((db) =>
                db.query("profile.role.update", (handle) =>
                  handle.update(user).set(changes).where(eq(user.id, authUser.id)),
                ),
              );

              return createSuccessResponse(update);
            }),
          "You must be logged in to update your role",
        );
      },
    },
  },
});
