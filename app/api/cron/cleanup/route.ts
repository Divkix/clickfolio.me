import { getDb } from "@/lib/db";
import { performCleanup } from "@/lib/cron/cleanup";
import { withCron } from "@/lib/cron/with-cron";
import { getR2Binding } from "@/lib/r2";

export const GET = withCron(async (env) =>
  performCleanup(getDb(env.HYPERDRIVE), getR2Binding(env)),
);
