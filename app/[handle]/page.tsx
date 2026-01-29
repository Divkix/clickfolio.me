import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttributionWidget } from "@/components/AttributionWidget";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import { CreateYoursCTA } from "@/components/CreateYoursCTA";
import { siteConfig } from "@/lib/config/site";
import { getResumeData, getResumeMetadata } from "@/lib/data/resume";
import { getTemplate } from "@/lib/templates/theme-registry";
import { isValidHandleFormat } from "@/lib/utils/handle-validation";

// Dynamic params are always allowed (new handles can be created)
export const dynamicParams = true;

interface PageProps {
  params: Promise<{
    handle: string;
  }>;
}

/**
 * Generate dynamic metadata for SEO
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;

  // Early reject invalid formats — skips DB query for bot probes, missing files, malformed paths
  // See: lib/utils/handle-validation.ts for why this exists
  if (!isValidHandleFormat(handle)) {
    return {
      title: "Not Found",
      description: "Page not found.",
    };
  }

  const data = await getResumeMetadata(handle);

  if (!data) {
    return {
      title: "Resume Not Found",
      description: "The requested resume could not be found.",
    };
  }

  const { full_name, headline, summary, avatar_url } = data;

  // Truncate summary to 160 characters for meta description
  const description = summary
    ? summary.slice(0, 157) + (summary.length > 157 ? "..." : "")
    : `View ${full_name}'s professional resume and experience.`;

  return {
    title: `${full_name}'s Resume — ${siteConfig.fullName}`,
    description,
    openGraph: {
      title: `${full_name} — ${headline ?? "Resume"}`,
      description,
      type: "profile",
      url: `${siteConfig.url}/${handle}`,
      images: avatar_url
        ? [
            {
              url: avatar_url,
              width: 400,
              height: 400,
              alt: full_name,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary",
      title: `${full_name} — ${headline ?? "Resume"}`,
      description,
      images: avatar_url ? [avatar_url] : undefined,
    },
  };
}

/**
 * Public resume viewer page
 * Renders user's resume with privacy filtering applied
 *
 * Caching: Cloudflare edge cache handles most traffic via Cache-Control headers.
 * Privacy-sensitive changes purge edge cache immediately via Cloudflare API.
 */
export default async function HandlePage({ params }: PageProps) {
  const { handle } = await params;

  // Early reject invalid formats — skips DB query for bot probes, missing files, malformed paths
  // See: lib/utils/handle-validation.ts for why this exists
  if (!isValidHandleFormat(handle)) {
    notFound();
  }

  const data = await getResumeData(handle);

  // Return 404 if profile or site_data not found
  if (!data) {
    notFound();
  }

  const { content, profile, theme_id } = data;

  // Dynamically select template based on theme_id
  const Template = await getTemplate(theme_id);

  // Map theme_id to CTA variant (use underscore format for CTA)
  const ctaVariant = (theme_id ?? "minimalist_editorial") as
    | "minimalist_editorial"
    | "neo_brutalist"
    | "glass_morphic"
    | "bento_grid"
    | "spotlight"
    | "midnight"
    | "bold_corporate";

  return (
    <>
      <Template
        content={content}
        profile={{
          avatar_url: profile.avatar_url,
          handle: profile.handle || handle,
        }}
      />
      <AnalyticsBeacon handle={handle} />
      <CreateYoursCTA handle={handle} variant={ctaVariant} />
      <AttributionWidget theme={theme_id ?? "minimalist_editorial"} />
    </>
  );
}
