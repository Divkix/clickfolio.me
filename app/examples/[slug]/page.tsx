import { env } from "cloudflare:workers";
import { and, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PersonCard, type DirectoryUser } from "@/components/explore/person-card";
import { Footer } from "@/components/Footer";
import { RoleSection, type RoleItem } from "@/components/role/RoleSection";
import { SiteHeader } from "@/components/SiteHeader";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";
import { getDb } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";
import { EXAMPLE_GALLERIES, type ExampleGallery } from "@/lib/examples/galleries";
import {
  buildRolePageMetadata,
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { isIndexableProfile } from "@/lib/seo/profile-indexability";
import { THEME_METADATA, themeSlug } from "@/lib/templates/theme-ids";
import { normalizePreviewSkills } from "@/lib/utils/preview-skills";
import { extractCityState, normalizePrivacySettings } from "@/lib/utils/privacy";

export const revalidate = 3600;

type GalleryPageProps = { params: Promise<{ slug: string }> };

const galleryCopy = {
  marketing: {
    intro:
      "Explore resume-based portfolios from marketers and content professionals. Use these public examples to compare how experience, skills, and results read on a hosted portfolio before creating your own.",
    observations: [
      {
        lead: "Results before responsibilities",
        body: "When writing your own page, lead with measurable campaign outcomes rather than a list of everyday tasks.",
      },
      {
        lead: "Brand and audience context",
        body: "Explain which brands, channels, or audiences your work served so a reader can understand the scope.",
      },
      {
        lead: "A clear marketing focus",
        body: "A specific headline and relevant skills help readers distinguish content, social media, and growth experience.",
      },
      {
        lead: "Readable experience",
        body: "Keep each role focused on the work you owned and the outcomes you can support from your resume.",
      },
    ],
  },
  engineering: {
    intro:
      "Browse resume-based portfolios across engineering disciplines, from software and DevOps to mechanical and chemical engineering. Compare how a public portfolio can connect technical experience, tools, and education in one shareable page.",
    observations: [
      {
        lead: "Projects with context",
        body: "Describe the problem, your contribution, and the result when presenting a technical project on your own page.",
      },
      {
        lead: "Tools tied to work",
        body: "Support a skills list with experience that explains how you used the languages, systems, or engineering tools.",
      },
      {
        lead: "A recognizable discipline",
        body: "Use a precise headline so readers can quickly tell which engineering roles match your background.",
      },
      {
        lead: "Evidence of progression",
        body: "Present relevant education and experience clearly rather than expecting readers to infer your technical foundation.",
      },
    ],
  },
  student: {
    intro:
      "See resume-based portfolios from students in engineering, computer science, and business. These public examples offer a starting point for sharing education, practical skills, and early experience without needing a long employment history.",
    observations: [
      {
        lead: "Education as context",
        body: "Make your course of study and relevant education easy to find when they are central to your current experience.",
      },
      {
        lead: "Projects count as evidence",
        body: "Describe coursework, personal projects, or student activities in terms of what you made or contributed.",
      },
      {
        lead: "Early experience matters",
        body: "Include relevant internships and part-time work, with concrete responsibilities rather than inflated job titles.",
      },
      {
        lead: "A focused skills list",
        body: "Choose skills you can explain through your studies or projects instead of listing every tool you have encountered.",
      },
    ],
  },
} satisfies Record<string, { intro: string; observations: RoleItem[] }>;

function getGallery(slug: string): ExampleGallery {
  const gallery = EXAMPLE_GALLERIES.find((entry) => entry.slug === slug);

  if (!gallery) notFound();

  return gallery;
}

const loadGalleryProfiles = cache(async (gallery: ExampleGallery): Promise<DirectoryUser[]> => {
  const db = getDb(env.HYPERDRIVE);

  const rows = await db
    .select({
      handle: user.handle,
      role: user.role,
      previewName: siteData.previewName,
      previewHeadline: siteData.previewHeadline,
      previewLocation: siteData.previewLocation,
      previewExpCount: siteData.previewExpCount,
      previewEduCount: siteData.previewEduCount,
      previewSkills: siteData.previewSkills,
      privacySettings: user.privacySettings,
      content: siteData.content,
    })
    .from(user)
    .innerJoin(siteData, eq(user.id, siteData.userId))
    .where(
      and(
        inArray(user.handle, [...gallery.handles]),
        eq(user.showInDirectory, true),
        eq(user.onboardingCompleted, true),
      ),
    );

  return rows
    .filter(
      (u): u is typeof u & { handle: string } =>
        u.handle !== null &&
        isIndexableProfile(u.content, normalizePrivacySettings(u.privacySettings)),
    )
    .sort((a, b) => gallery.handles.indexOf(a.handle) - gallery.handles.indexOf(b.handle))
    .map((u) => {
      const previewSkills = normalizePreviewSkills(u.previewSkills);
      const showAddress = normalizePrivacySettings(u.privacySettings).show_address;

      const previewLocation =
        u.previewLocation && !showAddress ? extractCityState(u.previewLocation) : u.previewLocation;

      return {
        handle: u.handle,
        role: u.role,
        previewName: u.previewName,
        previewHeadline: u.previewHeadline,
        previewLocation,
        previewExpCount: u.previewExpCount,
        previewEduCount: u.previewEduCount,
        previewSkills: previewSkills.length > 0 ? previewSkills : null,
      };
    });
});

export function generateStaticParams() {
  return EXAMPLE_GALLERIES.map((gallery) => ({ slug: gallery.slug }));
}

export async function generateMetadata({ params }: GalleryPageProps): Promise<Metadata> {
  const gallery = getGallery((await params).slug);
  const profiles = await loadGalleryProfiles(gallery);

  const metadata = buildRolePageMetadata({
    title: gallery.title,
    description: gallery.description,
    path: `/examples/${gallery.slug}`,
  });

  if (profiles.length < 3) metadata.robots = { index: false, follow: true };

  return metadata;
}

export default async function ExampleGalleryPage({ params }: GalleryPageProps) {
  const gallery = getGallery((await params).slug);
  const profiles = await loadGalleryProfiles(gallery);
  const copy = Object.entries(galleryCopy).find(([slug]) => slug === gallery.slug)?.[1];

  if (!copy) notFound();
  const path = `/examples/${gallery.slug}`;

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: gallery.title,
    numberOfItems: profiles.length,
    itemListElement: profiles.map((profile, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${siteConfig.url}/@${profile.handle}`,
    })),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            generateWebPageJsonLd(gallery.title, path, gallery.description),
            generatePageBreadcrumbJsonLd(gallery.title, path),
            itemList,
          ]),
        }}
      />
      <SiteHeader />
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: gallery.title, href: path },
        ]}
      />
      <main id="main-content" className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full">
        <h1 className="font-extrabold text-3xl sm:text-4xl text-foreground mb-4">
          {gallery.title}
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-3xl">{copy.intro}</p>
        <section className="mb-12" aria-labelledby="gallery-profiles">
          <h2 id="gallery-profiles" className="sr-only">
            Public portfolio examples
          </h2>
          {profiles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {profiles.map((person) => (
                <PersonCard key={person.handle} person={person} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No curated profiles are currently public in this gallery. You can still browse the{" "}
              <Link className="underline" href="/explore">
                professional directory
              </Link>{" "}
              for inspiration.
            </p>
          )}
        </section>
        <RoleSection
          heading="What these portfolios do well"
          intro="Use the examples above as a starting point, not a checklist every person must meet. These are useful principles for shaping your own portfolio."
          items={copy.observations}
        />
        <section className="mb-12">
          <h2 className="font-bold text-xl text-foreground mb-4">
            Choose a template for your own portfolio
          </h2>
          <p className="text-muted-foreground mb-4">
            Start with your PDF resume: clickfolio.me uses AI to parse it into a hosted portfolio at
            clickfolio.me/@handle. All 14 themes are free. These themes are starting points to
            consider, not a claim about which themes the examples above use.
          </p>
          <ul className="list-disc pl-5 space-y-2 mb-4">
            {gallery.themes.map((id) => (
              <li key={id}>
                <Link className="underline" href={`/templates/${themeSlug(id)}`}>
                  {THEME_METADATA[id].name}
                </Link>
              </li>
            ))}
          </ul>
          <Link className="underline" href={`/for/${gallery.forSlug}`}>
            Learn how to build a portfolio for your role
          </Link>
        </section>
        <section className="mb-12">
          <h2 className="font-bold text-xl text-foreground mb-4">More portfolio inspiration</h2>
          <ul className="list-disc pl-5 space-y-2">
            {EXAMPLE_GALLERIES.filter((entry) => entry.slug !== gallery.slug).map((entry) => (
              <li key={entry.slug}>
                <Link className="underline" href={`/examples/${entry.slug}`}>
                  {entry.title}
                </Link>
              </li>
            ))}
            <li>
              <Link className="underline" href="/explore">
                Browse all professional portfolios
              </Link>
            </li>
          </ul>
        </section>
        <Button asChild size="lg">
          <Link href="/">Create Your Free Portfolio</Link>
        </Button>
      </main>
      <Footer />
    </div>
  );
}
