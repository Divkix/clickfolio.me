import { createFileRoute } from "@tanstack/react-router";
import { performCleanup } from "@/lib/cron/cleanup";
import { withCron } from "@/lib/cron/with-cron";

const cleanup = withCron((env) => performCleanup(env));

export const Route = createFileRoute("/api/cron/cleanup")({
  server: {
    handlers: {
      GET: ({ request }) => cleanup(request),
    },
  },
});
