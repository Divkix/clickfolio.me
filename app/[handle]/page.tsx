import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttributionWidget } from "@/components/AttributionWidget";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import { CreateYoursCTA } from "@/components/CreateYoursCTA";
import { SharePopover, type SharePopoverVariant } from "@/components/SharePopover";
import { siteConfig } from "@/lib/config/site";
import { getResumeData, getResumeMetadata } from "@/lib/data/resume";
import { DEFAULT_THEME, type ThemeId } from "@/lib/templates/theme-ids";
import { getTemplate } from "@/lib/templates/theme-registry";
import { isValidHandleFormat } from "@/lib/utils/handle-validation";
import {
  generateBreadcrumbJsonLd,
  generateResumeJsonLd,
  serializeJsonLd,
} from "@/lib/utils/json-ld";

// Map database theme IDs (underscore) to share popover variants (kebab-case)
const themeToShareVariant: Record<ThemeId, SharePopoverVariant> = {
  minimalist_editorial: "minimalist-editorial",
  neo_brutalist: "neo-brutalist",
  glass: "glass-morphic",
  bento: "bento-grid",
  spotlight: "spotlight",
  midnight: "midnight",
  bold_corporate: "bold-corporate",
  classic_ats: "classic-ats",
  design_folio: "design-folio",
  dev_terminal: "dev-terminal",
};

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
  const { handle: rawHandleEncoded } = await params;

  // Decode URL-encoded characters (@ becomes %40 in route params)
  const rawHandle = decodeURIComponent(rawHandleEncoded);

  // Handle must start with @ (new URL format: /@username)
  // Old URLs without @ are redirected via next.config.ts
  if (!rawHandle.startsWith("@")) {
    return {
      title: "Not Found",
      description: "Page not found.",
    };
  }

  // Strip @ prefix for DB lookup
  const handle = rawHandle.slice(1);

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

  const { full_name, headline, summary, hide_from_search } = data;

  // Truncate summary to 160 characters for meta description
  const description = summary
    ? summary.slice(0, 157) + (summary.length > 157 ? "..." : "")
    : `View ${full_name}'s professional resume and experience.`;

  const profileUrl = `${siteConfig.url}/@${handle}`;

  return {
    title: `${full_name}'s Resume — ${siteConfig.fullName}`,
    description,
    // Canonical URL for proper SEO
    alternates: {
      canonical: profileUrl,
    },
    // Conditional noindex when user opts out of search indexing
    ...(hide_from_search && {
      robots: {
        index: false,
        follow: false,
      },
    }),
    openGraph: {
      title: `${full_name} — ${headline ?? "Resume"}`,
      description,
      type: "profile",
      url: profileUrl,
      siteName: siteConfig.fullName,
      images: [
        {
          url: `${siteConfig.url}/api/og/${handle}`,
          width: 1200,
          height: 630,
          alt: full_name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${full_name} — ${headline ?? "Resume"}`,
      description,
      images: [`${siteConfig.url}/api/og/${handle}`],
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
  const { handle: rawHandleEncoded } = await params;

  // Decode URL-encoded characters (@ becomes %40 in route params)
  const rawHandle = decodeURIComponent(rawHandleEncoded);

  // Handle must start with @ (new URL format: /@username)
  // Old URLs without @ are redirected via next.config.ts
  if (!rawHandle.startsWith("@")) {
    notFound();
  }

  // Strip @ prefix for DB lookup
  const handle = rawHandle.slice(1);

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

  const { content, profile, theme_id, privacy_settings } = data;

  // Dynamically select template based on theme_id
  const Template = await getTemplate(theme_id);

  // Map theme_id to CTA variant (use underscore format for CTA)
  const ctaVariant = (theme_id ?? DEFAULT_THEME) as
    | "minimalist_editorial"
    | "neo_brutalist"
    | "glass_morphic"
    | "bento_grid"
    | "spotlight"
    | "midnight"
    | "bold_corporate"
    | "dev_terminal";

  // Generate JSON-LD structured data for SEO (skip if user opted out)
  const profileUrl = `${siteConfig.url}/@${handle}`;
  const jsonLd = !privacy_settings.hide_from_search
    ? generateResumeJsonLd(content, {
        profileUrl,
        avatarUrl: profile.avatar_url,
      })
    : null;

  // JSON-LD is safe to inject:
  // - Content is validated at write time (/api/resume/update)
  // - JSON.stringify properly escapes special characters
  // - Data is from trusted D1 database, not user input
  const jsonLdScript = jsonLd ? serializeJsonLd(jsonLd) : null;

  // Breadcrumb JSON-LD for navigation context in search results
  const breadcrumbJsonLd = !privacy_settings.hide_from_search
    ? serializeJsonLd(generateBreadcrumbJsonLd(handle, content.full_name))
    : null;

  // Map theme_id to share popover variant (kebab-case format)
  // Cast theme_id to ThemeId since it's validated against the enum in the database
  const shareVariant = themeToShareVariant[(theme_id ?? DEFAULT_THEME) as ThemeId];
  const pageTitle = `${content.full_name}'s Resume`;

  return (
    <>
      {/* JSON-LD structured data for rich search results */}
      {jsonLdScript && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from trusted DB, JSON.stringify escapes special chars
          dangerouslySetInnerHTML={{ __html: jsonLdScript }}
        />
      )}
      {/* Breadcrumb JSON-LD for navigation context in search results */}
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Breadcrumb JSON-LD from trusted DB data, serialized with XSS-safe escaping via serializeJsonLd
          dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }}
        />
      )}
      <Template
        content={content}
        profile={{
          avatar_url: profile.avatar_url,
          handle: profile.handle || handle,
        }}
      />
      <AnalyticsBeacon handle={handle} />
      {/* Floating actions for visitors */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 print:hidden">
        <CreateYoursCTA handle={handle} variant={ctaVariant} />
      </div>
      <SharePopover
        handle={handle}
        name={content.full_name}
        title={pageTitle}
        variant={shareVariant}
      />
      <AttributionWidget theme={theme_id ?? DEFAULT_THEME} />
    </>
  );
}
