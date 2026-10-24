import { Effect } from "effect";
import { env } from "cloudflare:workers";
import { withAdminEffect } from "@/lib/auth/with-auth";
import { analyticsPeriodSchema, loadAdminAnalytics } from "@/lib/data/admin-analytics";
import { InvalidInput } from "@/lib/effect/failures";
import { Umami } from "@/lib/effect/services/umami";
import { createSuccessResponse } from "@/lib/utils/security-headers";

export async function GET(request: Request) {
  return withAdminEffect(request, () =>
    Effect.gen(function* () {
      const period = analyticsPeriodSchema.safeParse(
        new URL(request.url).searchParams.get("period") || "7d",
      );

      if (!period.success) {
        return yield* Effect.fail(new InvalidInput({ message: "Invalid period" }));
      }

      const data = yield* loadAdminAnalytics(period.data);
      const response = createSuccessResponse(data);
      response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");

      return response;
    }).pipe(Effect.provide(Umami.layer(env))),
  );
}
