import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { edgeCacheHeaders } from "@/lib/cache/edge-cache";
import { HomeLanding } from "@/components/home/landing/HomeLanding";
import { HomeJsonLd } from "@/components/home/landing/HomeJsonLd";
import { HOME_HEAD } from "@/lib/seo/page-metadata";

// Ad platforms fill these with numeric ids (`{campaignid}`), which the router parses as numbers;
// rejecting them would redirect to a bare `/` and drop the attribution.
const utmParam = z.union([z.string(), z.number()]).optional().catch(undefined);

export const Route = createFileRoute("/")({
  head: () => HOME_HEAD,
  headers: () => edgeCacheHeaders(3600),
  validateSearch: z.object({
    utm_source: utmParam,
    utm_medium: utmParam,
    utm_campaign: utmParam,
  }),
  component: Home,
});

function Home() {
  return (
    <>
      <HomeJsonLd />
      <HomeLanding />
    </>
  );
}
