import { env } from "cloudflare:workers";
import { requireCronAuth } from "@/lib/auth/middleware";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

// eslint-disable-next-line anti-slop/no-unknown-returns -- cron handlers return varied JSON (cleanup stats, sync counts); wrapper serializes via createSuccessResponse
export function withCron(handler: (env: CloudflareEnv) => Promise<unknown>) {
  return async (request: Request): Promise<Response> => {
    // SAFETY: env from cloudflare:workers is CloudflareEnv at runtime; cast bridges stub typing.
    const authError = requireCronAuth(request, env as CloudflareEnv);
    if (authError) return authError;
    try {
      // SAFETY: same env cast as above.
      const result = await handler(env as CloudflareEnv);
      if (result instanceof Response) return result;
      return createSuccessResponse(result);
    } catch (error) {
      console.error("cron failed:", error);
      return createErrorResponse("Cron failed", ERROR_CODES.INTERNAL_ERROR, 500);
    }
  };
}
