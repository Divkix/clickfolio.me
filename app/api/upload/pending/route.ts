import { Effect } from "effect";
import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { decodeJsonBody, runRoute } from "@/lib/api/route";
import { claimRequestSchema } from "@/lib/schemas/resume";
import { getEnvValue } from "@/lib/utils/env";
import { getR2Binding, R2 } from "@/lib/r2";
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

export async function POST(request: Request) {
  return runRoute(
    request,
    Effect.gen(function* () {
      const { key } = yield* decodeJsonBody(request, claimRequestSchema, {
        message: "Invalid upload key",
        code: "BAD_REQUEST",
      });

      return yield* Effect.promise(() => savePendingUpload(key));
    }),
  );
}

async function savePendingUpload(key: string): Promise<Response> {
  try {
    // SAFETY: env is untyped Cloudflare Workers binding; cast bridges to typed CloudflareEnv.
    const typedEnv = env as CloudflareEnv;
    const secret = getEnvValue(typedEnv, "PENDING_UPLOAD_SECRET");

    const r2 = getR2Binding(typedEnv);
    const head = r2 ? await R2.head(r2, key) : null;

    if (!head?.exists) {
      return createErrorResponse("Upload not found", ERROR_CODES.NOT_FOUND, 404);
    }

    const cookieValue = await createSignedCookieValue(key, secret);
    const cookieStore = await cookies();

    cookieStore.set(COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return createSuccessResponse({ success: true });
  } catch (error) {
    log("error", "Error setting pending upload cookie:", { ...errorFields(error) });

    return createErrorResponse("Failed to save upload", ERROR_CODES.INTERNAL_ERROR, 500);
  }
}

export async function GET() {
  try {
    // SAFETY: env is untyped Cloudflare Workers binding; cast bridges to typed CloudflareEnv.
    const typedEnv = env as CloudflareEnv;
    const secret = getEnvValue(typedEnv, "PENDING_UPLOAD_SECRET");

    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);

    if (!cookie?.value) {
      return createSuccessResponse({ key: null });
    }

    const parsed = await parseSignedCookieValue(cookie.value, secret);

    if (!parsed) {
      return createSuccessResponse({ key: null });
    }

    return createSuccessResponse({ key: parsed.tempKey });
  } catch (error) {
    log("error", "Error reading pending upload cookie:", { ...errorFields(error) });

    return createSuccessResponse({ key: null });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);

    return createSuccessResponse({ success: true });
  } catch (error) {
    log("error", "Error clearing pending upload cookie:", { ...errorFields(error) });

    return createSuccessResponse({ success: true });
  }
}
