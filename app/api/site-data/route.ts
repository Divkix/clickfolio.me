import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { withUser } from "@/lib/auth/with-auth";
import { siteData } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { runRoute } from "@/lib/effect/edges";
import { createSuccessResponse } from "@/lib/utils/security-headers";

export async function GET(request?: Request) {
  return withUser(
    request,
    async ({ user, db }) => {
      const program = Db.use((service) =>
        service.query("site-data.get", (handle) =>
          handle
            .select({
              id: siteData.id,
              userId: siteData.userId,
              resumeId: siteData.resumeId,
              content: siteData.content,
              themeId: siteData.themeId,
              lastPublishedAt: siteData.lastPublishedAt,
              createdAt: siteData.createdAt,
              updatedAt: siteData.updatedAt,
            })
            .from(siteData)
            .where(eq(siteData.userId, user.id))
            .limit(1),
        ),
      ).pipe(Effect.map((rows) => createSuccessResponse(rows[0] ?? null)));

      // The auth wrapper already opened this request's pool; the service reuses it.
      return runRoute(request, program, Db.layerFrom(db));
    },
    "You must be logged in to access site data",
  );
}
