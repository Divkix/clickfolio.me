import { env } from "cloudflare:workers";
import { requireAdminAuth } from "@/lib/auth/admin";
import { analyticsPeriodSchema, loadAdminAnalytics } from "@/lib/data/admin-analytics";
import { runPage } from "@/lib/effect/edges";
import { Umami } from "@/lib/effect/services/umami";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminAuth();

  const params = await searchParams;
  const parsedPeriod = analyticsPeriodSchema.safeParse(params.period);
  const period = parsedPeriod.success ? parsedPeriod.data : "7d";
  const data = await runPage(loadAdminAnalytics(period), Umami.layer(env));

  return <AnalyticsClient data={data} period={period} />;
}
