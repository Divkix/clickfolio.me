import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AttributionWidget } from "@/components/AttributionWidget";
import { OwnerDetector } from "@/components/analytics/OwnerDetector";
import { CreateYoursCTA } from "@/components/CreateYoursCTA";
import { SharePopover } from "@/components/SharePopover";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ProfileError } from "@/components/errors/ProfileError";
import { ProfileNotFound } from "@/components/errors/ProfileNotFound";
import { edgeCacheHeaders, profileCacheTag } from "@/lib/cache/edge-cache";
import { siteConfig } from "@/lib/config/site";
import { profilePageData } from "@/lib/data/public-resume";
import { buildProfileTitle, NOINDEX, pageHead, titleTag } from "@/lib/seo/page-metadata";
import { getTemplate, ThemeTemplate } from "@/lib/templates/theme-registry";

const getProfile = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(({ data }) => profilePageData(data));

export const Route = createFileRoute("/@{$handle}")({
  loader: async ({ params }) => {
    const page = await getProfile({ data: params.handle });
    await getTemplate(page.data.theme_id);

    return page;
  },
  head: ({ loaderData }) => {
    if (!loaderData?.metadata) {
      return pageHead({
        title: titleTag("Resume Not Found"),
        description: "The requested resume could not be found.",
      });
    }

    const { handle, metadata } = loaderData;
    const { full_name, headline, indexable, location, skills } = metadata;
    const descParts = [full_name];

    if (headline) descParts.push(`— ${headline}`);

    if (location) descParts.push(`in ${location}`);

    if (skills?.length) descParts.push(`| ${skills.slice(0, 4).join(", ")}`);

    const assembled = descParts.join(" ");
    const description = assembled.length > 157 ? `${assembled.slice(0, 157)}...` : assembled;
    const pageTitle = buildProfileTitle(full_name, headline);
    const profileUrl = `${siteConfig.url}/@${handle}`;
    const nameParts = full_name.split(" ");
    const lastName = nameParts.slice(1).join(" ");

    const profileProperties = {
      "profile:first_name": nameParts[0] ?? full_name,
      "profile:username": handle,
    };

    const head = pageHead({
      title: titleTag(pageTitle),
      description,
      canonical: profileUrl,
      robots: indexable ? undefined : NOINDEX,
      social: {
        title: pageTitle,
        description,
        type: "profile",
        url: profileUrl,
        image: {
          url: `${siteConfig.url}/api/og/${handle}`,
          width: 1200,
          height: 630,
          alt: full_name,
          type: "image/png",
        },
        properties: lastName
          ? { ...profileProperties, "profile:last_name": lastName }
          : profileProperties,
      },
    });

    return head;
  },
  headers: ({ params }) => edgeCacheHeaders(300, [profileCacheTag(params.handle)]),
  component: HandlePage,
  errorComponent: ProfileError,
  notFoundComponent: ProfileNotFound,
});

function HandlePage() {
  const { handle, data: resumeData, metadata, chrome } = Route.useLoaderData();
  const { content, profile, theme_id, privacy_settings } = resumeData;
  const pageTitle = `${content.full_name}'s Resume`;

  return (
    <>
      {metadata?.jsonLdResumeScript && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: metadata.jsonLdResumeScript }}
        />
      )}
      {metadata?.jsonLdBreadcrumbScript && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: metadata.jsonLdBreadcrumbScript }}
        />
      )}
      {!privacy_settings.hide_from_search && (
        <Breadcrumb
          includeJsonLd={false}
          items={[
            { label: "Home", href: "/" },
            { label: "Explore", href: "/explore" },
            { label: `@${handle}`, href: `/@${handle}` },
          ]}
        />
      )}
      <main id="main-content">
        <ThemeTemplate
          themeId={theme_id}
          content={content}
          share={chrome.share}
          profile={{
            avatar_url: profile.avatar_url,
            handle: profile.handle || handle,
          }}
        />
      </main>
      <OwnerDetector profileId={profile.id} />
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 print:hidden">
        <CreateYoursCTA handle={handle} profileId={profile.id} styles={chrome.cta} />
      </div>
      <SharePopover
        handle={handle}
        name={content.full_name}
        title={pageTitle}
        styles={chrome.share}
      />
      <AttributionWidget styles={chrome.attribution} />
    </>
  );
}
