import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { isDisposableEmail } from "@/lib/email/disposable-check";
import { checkEmailValidateRateLimit, getClientIP } from "@/lib/utils/ip-rate-limit";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

const emailValidateSchema = z.object({
  email: z.string().trim().min(1).email({ message: "Invalid email address" }),
});

/**
 * POST /api/email/validate
 * Check if an email uses a disposable domain (public endpoint).
 * Called on blur from the signup form.
 *
 * Rate limited by IP to prevent abuse.
 * Never reveals whether email exists (prevents enumeration).
 * Fails open on errors.
 */
export async function POST(request: Request) {
  try {
    // 1. Parse and validate request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return createErrorResponse("Invalid request body", ERROR_CODES.BAD_REQUEST, 400);
    }

    const parsed = emailValidateSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse("Invalid email format", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    // 2. IP-based rate limiting
    const clientIP = getClientIP(request);
    const rateLimitResult = await checkEmailValidateRateLimit(clientIP);

    if (!rateLimitResult.allowed) {
      return createErrorResponse(
        rateLimitResult.message || "Too many requests. Please try again later.",
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        429,
      );
    }

    // 3. Check if email is disposable
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { DISPOSABLE_DOMAINS?: KVNamespace }).DISPOSABLE_DOMAINS ?? null;
    const result = await isDisposableEmail(parsed.data.email, kv);

    if (result.disposable) {
      return createSuccessResponse({
        valid: false,
        reason: "Please use a permanent email address",
      });
    }

    return createSuccessResponse({ valid: true });
  } catch (error) {
    console.error("[EMAIL_VALIDATE] Unexpected error:", error);
    // Fail open — don't block signups due to validation endpoint errors
    return createSuccessResponse({ valid: true });
  }
}
