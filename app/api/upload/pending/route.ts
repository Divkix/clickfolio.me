import { Effect, Layer } from "effect";
import { cookies } from "next/headers";
import { runRoute } from "@/lib/effect/edges";
import { COOKIE_NAME } from "@/lib/utils/pending-upload-cookie";
import { createSuccessResponse } from "@/lib/utils/security-headers";

function clearPendingUpload() {
  return Effect.promise(async () => {
    (await cookies()).delete(COOKIE_NAME);

    return createSuccessResponse({ success: true });
  });
}

export async function DELETE(request?: Request) {
  return runRoute(request, clearPendingUpload(), Layer.empty);
}
