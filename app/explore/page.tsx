import { env } from "cloudflare:workers";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ExploreFilters } from "@/components/explore/explore-filters";
import { ExploreHeader } from "@/components/explore/explore-header";
import { ExplorePagination } from "@/components/explore/explore-pagination";
import { NoResults } from "@/components/explore/no-results";
import { PersonCard, type DirectoryUser } from "@/components/explore/person-card";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";
import { getDb } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";
import { ROLE_OPTIONS } from "@/lib/schemas/profile";
import { generateExploreJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { buildPublicPageMetadata } from "@/lib/seo/page-metadata";
import { normalizePreviewSkills } from "@/lib/utils/preview-skills";
import { extractCityState, normalizePrivacySettings } from "@/lib/utils/privacy";
import { safePageParam } from "@/lib/utils/pagination";

export const revalidate = 300;

const exploreTitle = `Browse Professional Portfolios | ${siteConfig.fullName}`;

const exploreDescription =
  "Discover professionals in our community. Browse portfolios and connect with talented individuals.";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Browse Professional Portfolios",
  ogTitle: exploreTitle,
  description: exploreDescription,
  path: "/explore",
});

const ITEMS_PER_PAGE = 12;

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; role?: string }>;
}) {
  const params = await searchParams;
  const currentPage = safePageParam(params.page);
  const roleFilter = params.role || "";

  const db = getDb(env.HYPERDRIVE);

  const whereConditions = [
    isNotNull(user.handle),
    eq(user.showInDirectory, true),
    eq(user.onboardingCompleted, true),
  ];

  if (roleFilter) {
    // SAFETY: searchParams are validated via Zod schema before use; roleFilter is from allowed ROLE_OPTIONS.
    whereConditions.push(eq(user.role, roleFilter as (typeof user.role.enumValues)[number]));
  }

  // One repeatable-read snapshot: the total count and the page rows are issued together so they
  // describe the same directory state.
  const [countResult, usersWithData] = await db.transaction(
    async (tx) => {
      const [countRows, pageRows] = await Promise.all([
        tx
          .select({ count: sql<number>`count(*)` })
          .from(user)
          .innerJoin(siteData, eq(user.id, siteData.userId))
          .where(and(...whereConditions)),

        tx
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
          })
          .from(user)
          .innerJoin(siteData, eq(user.id, siteData.userId))
          .where(and(...whereConditions))
          // user_id breaks updated_at ties so a row never shifts between pages.
          .orderBy(desc(siteData.updatedAt), desc(siteData.userId))
          .limit(ITEMS_PER_PAGE)
          .offset((currentPage - 1) * ITEMS_PER_PAGE),
      ]);

      return [countRows, pageRows] as const;
    },
    { isolationLevel: "repeatable read" },
  );

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const directoryUsers: DirectoryUser[] = usersWithData
    .filter((u) => u.handle !== null)
    .map((u) => {
      const previewSkills = normalizePreviewSkills(u.previewSkills);
      const showAddress = normalizePrivacySettings(u.privacySettings).show_address;

      const previewLocation =
        u.previewLocation && !showAddress ? extractCityState(u.previewLocation) : u.previewLocation;

      // SAFETY: handle is filtered for non-null above; cast bridges nullable to string.
      return {
        handle: u.handle as string,
        role: u.role,
        previewName: u.previewName,
        previewHeadline: u.previewHeadline,
        previewLocation,
        previewExpCount: u.previewExpCount,
        previewEduCount: u.previewEduCount,
        previewSkills: previewSkills.length > 0 ? previewSkills : null,
      };
    });

  const exploreJsonLd = generateExploreJsonLd(
    directoryUsers.map((u) => ({
      handle: u.handle,
      name: u.previewName || "Unknown",
      headline: u.previewHeadline,
    })),
  );

  const roleOptions = [{ value: "", label: "All Roles" }, ...ROLE_OPTIONS];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(exploreJsonLd) }}
      />
      {currentPage > 1 && (
        <link
          rel="prev"
          href={`${siteConfig.url}/explore?page=${currentPage - 1}${roleFilter ? `&role=${roleFilter}` : ""}`}
        />
      )}
      {currentPage < totalPages && (
        <link
          rel="next"
          href={`${siteConfig.url}/explore?page=${currentPage + 1}${roleFilter ? `&role=${roleFilter}` : ""}`}
        />
      )}
      <SiteHeader />
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Explore Professionals", href: "/explore" },
        ]}
      />
      <main id="main-content" className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full">
        <ExploreHeader />

        <ExploreFilters roleFilter={roleFilter} roleOptions={roleOptions} totalCount={totalCount} />

        {directoryUsers.length === 0 ? (
          <NoResults roleFilter={roleFilter} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {directoryUsers.map((person) => (
              <PersonCard key={person.handle} person={person} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <ExplorePagination
            currentPage={currentPage}
            totalPages={totalPages}
            roleFilter={roleFilter}
          />
        )}

        <div className="mt-16 text-center bg-brand-subtle rounded-xl border border-border p-8">
          <h2 className="text-2xl font-bold text-foreground mb-3">Join Our Directory</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Want to be featured here? Enable &ldquo;Show in Directory&rdquo; in your privacy
            settings to get discovered by recruiters and collaborators.
          </p>
          <Button asChild size="lg">
            <Link href="/settings">Update Privacy Settings</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
