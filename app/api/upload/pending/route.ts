import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { z } from "zod";
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
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";

export async function POST(request: Request) {
  try {
    // SAFETY: env is untyped Cloudflare Workers binding; cast bridges to typed CloudflareEnv.
    const typedEnv = env as CloudflareEnv;
    const secret = getEnvValue(typedEnv, "PENDING_UPLOAD_SECRET");

    const sizeCheck = validateRequestSize(request);
    if (!sizeCheck.valid) {
      return createErrorResponse(
        sizeCheck.error || "Request body too large",
        ERROR_CODES.BAD_REQUEST,
        413,
      );
    }

    const rawBodyResult = await readJsonWithLimit(request);
    if (!rawBodyResult.ok) {
      return createErrorResponse(
        rawBodyResult.error,
        ERROR_CODES.BAD_REQUEST,
        rawBodyResult.reason === "too_large" ? 413 : 400,
      );
    }
    // SAFETY: rawBodyResult.data is bounded JSON from validated request; cast extracts optional key field.
    const body = rawBodyResult.data as { key?: string };
    const { key } = body ?? {};

    if (!key || !z.string().safeParse(key).success || !key.startsWith("temp/")) {
      return createErrorResponse("Invalid upload key", ERROR_CODES.BAD_REQUEST, 400);
    }

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
    console.error("Error setting pending upload cookie:", error);
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
    console.error("Error reading pending upload cookie:", error);
    return createSuccessResponse({ key: null });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
    return createSuccessResponse({ success: true });
  } catch (error) {
    console.error("Error clearing pending upload cookie:", error);
    return createSuccessResponse({ success: true });
  }
}
