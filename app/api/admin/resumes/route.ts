import { Effect } from "effect";
import { withAdminEffect } from "@/lib/auth/with-auth";
import {
  adminResumeStatusSchema,
  adminResumesParamsSchema,
  loadAdminResumes,
} from "@/lib/data/admin-resumes";
import { InvalidInput } from "@/lib/effect/failures";
import { createSuccessResponse } from "@/lib/utils/security-headers";

export async function GET(request: Request) {
  return withAdminEffect(request, () => {
    const searchParams = new URL(request.url).searchParams;
    const status = adminResumeStatusSchema.safeParse(searchParams.get("status") || "all");

    if (!status.success) {
      return Effect.fail(new InvalidInput({ message: "Invalid status filter" }));
    }

    const params = adminResumesParamsSchema.parse({
      page: searchParams.get("page"),
      status: status.data,
    });

    return loadAdminResumes(params).pipe(Effect.map(createSuccessResponse));
  });
}
