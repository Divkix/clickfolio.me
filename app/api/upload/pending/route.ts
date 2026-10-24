import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";
import { cookies } from "next/headers";
import { runRoute } from "@/lib/effect/edges";
import { getOptionalEnvValue } from "@/lib/utils/env";
import { log } from "@/lib/utils/log";
import { COOKIE_NAME, parseSignedCookieValue } from "@/lib/utils/pending-upload-cookie";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

/** The temp key of a valid, unexpired cookie; a missing or forged cookie is simply "none". */
function readPendingUpload() {
  return Effect.gen(function* () {
    const secret = getOptionalEnvValue(env, "PENDING_UPLOAD_SECRET");

    if (!secret) {
      log("error", "PENDING_UPLOAD_SECRET is not configured; pending uploads cannot be verified");

      return createErrorResponse("Failed to read pending upload", ERROR_CODES.INTERNAL_ERROR, 500);
    }

    const cookie = yield* Effect.promise(async () => (await cookies()).get(COOKIE_NAME));

    if (!cookie?.value) return createSuccessResponse({ key: null });

    const parsed = yield* Effect.promise(() => parseSignedCookieValue(cookie.value, secret));

    return createSuccessResponse({ key: parsed?.tempKey ?? null });
  });
}

export async function GET(request?: Request) {
  return runRoute(request, readPendingUpload(), Layer.empty);
}

function clearPendingUpload() {
  return Effect.promise(async () => {
    (await cookies()).delete(COOKIE_NAME);

    return createSuccessResponse({ success: true });
  });
}

export async function DELETE(request?: Request) {
  return runRoute(request, clearPendingUpload(), Layer.empty);
}
