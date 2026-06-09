import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttributionWidget } from "@/components/AttributionWidget";
import { OwnerDetector } from "@/components/analytics/OwnerDetector";
import { CreateYoursCTA } from "@/components/CreateYoursCTA";
import { RelatedProfiles } from "@/components/RelatedProfiles";
import { SharePopover } from "@/components/SharePopover";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { siteConfig } from "@/lib/config/site";
import { getRelatedProfiles, getResumeData, getResumeMetadata } from "@/lib/data/resume";
import { isValidHandleFormat } from "@/lib/rate-limit/handle-validation";
import { flattenSkills } from "@/lib/templates/helpers";
import { DEFAULT_THEME, type ThemeId, themeToShareVariant } from "@/lib/templates/theme-ids";
import { getTemplate } from "@/lib/templates/theme-registry";

// Dynamic params are always allowed (new handles can be created)
export const dynamicParams = true;
export const revalidate = 3600;

/** Props for the public resume viewer page. */
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

  const { full_name, headline, hide_from_search, location, skills, created_at, updated_at } = data;

  const descParts: string[] = [full_name];
  if (headline) descParts.push(`— ${headline}`);
  if (location) descParts.push(`in ${location}`);
  if (skills?.length) descParts.push(`| ${skills.slice(0, 4).join(", ")}`);
  const assembled = descParts.join(" ");
  const description = assembled.length > 157 ? `${assembled.slice(0, 157)}...` : assembled;

  const profileUrl = `${siteConfig.url}/@${handle}`;
  const nameParts = full_name.split(" ");
  const firstName = nameParts[0] ?? full_name;
  const lastName = nameParts.slice(1).join(" ") || undefined;

  return {
    title: `${full_name}${headline ? ` — ${headline}` : ""}`,
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
      title: `${full_name}${headline ? ` — ${headline}` : ""}`,
      description,
      type: "profile",
      url: profileUrl,
      siteName: siteConfig.fullName,
      firstName,
      lastName,
      username: handle,
      images: [
        {
          url: `${siteConfig.url}/api/og/${handle}`,
          width: 1200,
          height: 630,
          alt: full_name,
        },
      ],
    },
    other: {
      "article:published_time": created_at,
      "article:modified_time": updated_at,
    },
    twitter: {
      card: "summary_large_image",
      title: `${full_name}${headline ? ` — ${headline}` : ""}`,
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

  // Fetch SEO metadata with pre-serialized JSON-LD (uses React.cache, no extra DB call)
  const metadata = await getResumeMetadata(handle);

  const relatedProfiles = !privacy_settings.hide_from_search
    ? await getRelatedProfiles(
        handle,
        content.skills ? flattenSkills(content.skills) : null,
        content.headline,
      )
    : [];

  // Dynamically select template based on theme_id
  const Template = await getTemplate(theme_id);

  // Map theme_id to CTA variant (use ThemeId type directly)
  const ctaVariant: ThemeId = (theme_id ?? DEFAULT_THEME) as ThemeId;

  // Map theme_id to share popover variant (kebab-case format)
  // Cast theme_id to ThemeId since it's validated against the enum in the database
  const shareVariant = themeToShareVariant[(theme_id ?? DEFAULT_THEME) as ThemeId];
  const pageTitle = `${content.full_name}'s Resume`;

  return (
    <>
      {/* JSON-LD structured data for rich search results */}
      {metadata?.jsonLdResumeScript && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: metadata.jsonLdResumeScript }}
        />
      )}
      {/* Breadcrumb JSON-LD for navigation context in search results */}
      {metadata?.jsonLdBreadcrumbScript && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: metadata.jsonLdBreadcrumbScript }}
        />
      )}
      {!privacy_settings.hide_from_search && (
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Explore", href: "/explore" },
            { label: `@${handle}`, href: `/@${handle}` },
          ]}
        />
      )}
      <Template
        content={content}
        profile={{
          avatar_url: profile.avatar_url,
          handle: profile.handle || handle,
        }}
      />
      <OwnerDetector profileId={profile.id} />
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
      <RelatedProfiles profiles={relatedProfiles} />
      <AttributionWidget theme={theme_id ?? DEFAULT_THEME} />
    </>
  );
}
