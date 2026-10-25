import { createFileRoute } from "@tanstack/react-router";
import { Effect, Layer } from "effect";
import { runRoute } from "@/lib/effect/edges";
import { COOKIE_NAME } from "@/lib/utils/pending-upload-cookie";
import { createSuccessResponse } from "@/lib/utils/security-headers";

function clearPendingUpload() {
  return Effect.sync(() => {
    const response = createSuccessResponse({ success: true });
    response.headers.set(
      "Set-Cookie",
      `${COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    );

    return response;
  });
}

export const Route = createFileRoute("/api/upload/pending")({
  server: {
    handlers: {
      DELETE: async ({ request }) => {
        return runRoute(request, clearPendingUpload(), Layer.empty);
      },
    },
  },
});
