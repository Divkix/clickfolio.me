import { getDb } from "@/lib/db";
import { recoverOrphanedResumes } from "@/lib/cron/recover-orphaned";
import { withCron } from "@/lib/cron/with-cron";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";

export const dynamic = "force-dynamic";

export const GET = withCron(async (env) => {
  const db = getDb(env.HYPERDRIVE);
  const queue = env.CLICKFOLIO_PARSE_QUEUE;
  if (!queue) {
    console.error("CLICKFOLIO_PARSE_QUEUE not available");
    return createErrorResponse("Queue unavailable", ERROR_CODES.INTERNAL_ERROR, 500);
  }
  return recoverOrphanedResumes(db, queue);
});
