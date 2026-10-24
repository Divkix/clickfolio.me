import { performCleanup } from "@/lib/cron/cleanup";
import { withCron } from "@/lib/cron/with-cron";

export const GET = withCron((env) => performCleanup(env));
