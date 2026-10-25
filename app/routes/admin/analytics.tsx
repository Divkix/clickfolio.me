import { env } from "cloudflare:workers";
import { requireAdminAuth } from "@/lib/auth/admin";
import { loadAdminAnalytics } from "@/lib/data/admin-analytics";
import { runPage } from "@/lib/effect/edges";
import { Umami } from "@/lib/effect/services/umami";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import AnalyticsClient from "@/components/admin/AnalyticsClient";
import { privatePageHead } from "@/lib/seo/page-metadata";

const searchSchema = z.object({ period: z.enum(["7d", "30d", "90d"]).catch("7d") });

const getAnalytics = createServerFn({ method: "GET" })
  .validator(searchSchema)
  .handler(async ({ data }) => {
    await requireAdminAuth();

    return runPage(loadAdminAnalytics(data.period), Umami.layer(env));
  });

export const Route = createFileRoute("/admin/analytics")({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams(searchSchema.parse({}))] },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getAnalytics({ data: deps }),
  head: () => privatePageHead("Admin Analytics"),
  component: AdminAnalyticsPage,
});

function AdminAnalyticsPage() {
  const data = Route.useLoaderData();
  const { period } = Route.useSearch();

  return <AnalyticsClient data={data} period={period} />;
}
