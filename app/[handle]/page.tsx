import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttributionWidget } from "@/components/AttributionWidget";
import { siteConfig } from "@/lib/config/site";
import { createClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/templates/theme-registry";
import type { ResumeContent } from "@/lib/types/database";
import { extractCityState, isValidPrivacySettings } from "@/lib/utils/privacy";

// Enable ISR-like caching: revalidate every hour
// This reduces DB load by ~99% for high-traffic pages
// Stale pages are served while revalidating in background
export const revalidate = 3600; // 1 hour in seconds

// Dynamic params are always allowed (new handles can be created)
export const dynamicParams = true;

interface PageProps {
  params: Promise<{
    handle: string;
  }>;
}

interface PrivacySettings {
  show_phone: boolean;
  show_address: boolean;
}

/**
 * Fetch user profile and resume data by handle
 * Applies privacy filtering based on user preferences
 */
async function getResumeData(handle: string) {
  const supabase = await createClient();

  // Fetch profile with site_data in a single query
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id,
      handle,
      email,
      avatar_url,
      headline,
      privacy_settings,
      site_data (
        content,
        theme_id,
        last_published_at
      )
    `,
    )
    .eq("handle", handle)
    .single();

  if (error || !data) {
    return null;
  }

  // Ensure site_data exists
  if (!data.site_data) {
    return null;
  }

  const siteData = Array.isArray(data.site_data) ? data.site_data[0] : data.site_data;

  // Deep clone content to avoid mutation
  const content: ResumeContent = JSON.parse(JSON.stringify(siteData.content));

  // Apply privacy filtering with type guard
  const privacySettings: PrivacySettings = isValidPrivacySettings(data.privacy_settings)
    ? data.privacy_settings
    : { show_phone: false, show_address: false };

  // Remove phone if privacy setting is false
  if (!privacySettings.show_phone && content.contact?.phone) {
    delete content.contact.phone;
  }

  // Filter address to city/state only if privacy setting is false
  if (!privacySettings.show_address && content.contact?.location) {
    content.contact.location = extractCityState(content.contact.location);
  }

  return {
    profile: {
      id: data.id,
      handle: data.handle,
      email: data.email,
      avatar_url: data.avatar_url,
      headline: data.headline,
    },
    content,
    theme_id: siteData.theme_id,
  };
}

/**
 * Generate dynamic metadata for SEO
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const data = await getResumeData(handle);

  if (!data) {
    return {
      title: "Resume Not Found",
      description: "The requested resume could not be found.",
    };
  }

  const { content, profile } = data;

  // Truncate summary to 160 characters for meta description
  const description = content.summary
    ? content.summary.slice(0, 157) + (content.summary.length > 157 ? "..." : "")
    : `View ${content.full_name}'s professional resume and experience.`;

  return {
    title: `${content.full_name}'s Resume — ${siteConfig.fullName}`,
    description,
    openGraph: {
      title: `${content.full_name} — ${content.headline}`,
      description,
      type: "profile",
      url: `${siteConfig.url}/${handle}`,
      images: profile.avatar_url
        ? [
            {
              url: profile.avatar_url,
              width: 400,
              height: 400,
              alt: content.full_name,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary",
      title: `${content.full_name} — ${content.headline}`,
      description,
      images: profile.avatar_url ? [profile.avatar_url] : undefined,
    },
  };
}

/**
 * Public resume viewer page
 * Renders user's resume with privacy filtering applied
 */
export default async function HandlePage({ params }: PageProps) {
  const { handle } = await params;
  const data = await getResumeData(handle);

  // Return 404 if profile or site_data not found
  if (!data) {
    notFound();
  }

  const { content, profile, theme_id } = data;

  // Dynamically select template based on theme_id
  const Template = getTemplate(theme_id);

  return (
    <>
      <Template
        content={content}
        profile={{
          avatar_url: profile.avatar_url,
          handle: profile.handle || handle,
        }}
      />
      <AttributionWidget theme={theme_id} />
    </>
  );
}
