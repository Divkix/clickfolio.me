import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";
import { cookies } from "next/headers";
import { z } from "zod";
import { runRoute } from "@/lib/effect/edges";
import { oversizedBodyResponse, readJsonBody } from "@/lib/effect/json-body";
import { R2Store } from "@/lib/effect/services/r2-store";
import { getOptionalEnvValue } from "@/lib/utils/env";
import { log } from "@/lib/utils/log";
import {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  createSignedCookieValue,
  parseSignedCookieValue,
} from "@/lib/utils/pending-upload-cookie";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

const pendingUploadRequestSchema = z.object({ key: z.string().startsWith("temp/") });

function missingSecret(): Response {
  log("error", "PENDING_UPLOAD_SECRET is not configured; pending uploads cannot be signed");

  return createErrorResponse("Failed to save upload", ERROR_CODES.INTERNAL_ERROR, 500);
}

function setPendingUpload(request: Request) {
  return Effect.gen(function* () {
    const secret = getOptionalEnvValue(env, "PENDING_UPLOAD_SECRET");

    if (!secret) return missingSecret();

    const { key } = yield* readJsonBody(request, pendingUploadRequestSchema, "Invalid upload key");

    const found = yield* R2Store.use((store) => store.head(key)).pipe(
      Effect.as(true),
      Effect.catchTag("R2ObjectMissing", () => Effect.succeed(false)),
    );

    if (!found) {
      return createErrorResponse("Upload not found", ERROR_CODES.NOT_FOUND, 404);
    }

    const cookieValue = yield* Effect.promise(() => createSignedCookieValue(key, secret));

    // cookies() signals "this render is dynamic" by throwing; inside the Effect that becomes a
    // defect the edge rethrows untouched, and any other failure is logged as a 500.
    yield* Effect.promise(async () => {
      const cookieStore = await cookies();

      cookieStore.set(COOKIE_NAME, cookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      });
    });

    return createSuccessResponse({ success: true });
  });
}

export async function POST(request: Request) {
  const oversized = oversizedBodyResponse(request);

  if (oversized) return oversized;

  return runRoute(request, setPendingUpload(request), R2Store.layer(env));
}

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
