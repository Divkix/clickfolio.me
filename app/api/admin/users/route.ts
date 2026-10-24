import { Effect } from "effect";
import { withAdminEffect } from "@/lib/auth/with-auth";
import { adminUsersParamsSchema, loadAdminUsers } from "@/lib/data/admin-users";
import { createSuccessResponse } from "@/lib/utils/security-headers";

export async function GET(request: Request) {
  return withAdminEffect(request, () => {
    const searchParams = new URL(request.url).searchParams;

    const params = adminUsersParamsSchema.parse({
      page: searchParams.get("page"),
      search: searchParams.get("search"),
    });

    return loadAdminUsers(params).pipe(Effect.map(createSuccessResponse));
  });
}
