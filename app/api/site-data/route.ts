import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { withUserEffect } from "@/lib/auth/with-auth";
import { siteData } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { createSuccessResponse } from "@/lib/utils/security-headers";

export async function GET(request?: Request) {
  return withUserEffect(
    request,
    ({ user }) =>
      Db.use((service) =>
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
      ).pipe(Effect.map((rows) => createSuccessResponse(rows[0] ?? null))),
    "You must be logged in to access site data",
  );
}
