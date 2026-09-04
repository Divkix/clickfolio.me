import { getR2Binding } from "@/lib/r2";
import { performR2Cleanup } from "@/lib/cron/cleanup-r2";
import { withCron } from "@/lib/cron/with-cron";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";

export const GET = withCron(async (env) => {
  const r2Binding = getR2Binding(env);
  if (!r2Binding) {
    return createErrorResponse("R2 bucket not available", ERROR_CODES.INTERNAL_ERROR, 500);
  }
  return performR2Cleanup(r2Binding);
});
