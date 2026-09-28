import { env } from "cloudflare:workers";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
import { isUserRole, ROLE_OPTIONS, type UserRole } from "@/lib/config/roles";
import { generateExploreJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { isIndexableProfile } from "@/lib/seo/profile-indexability";
import { buildPublicPageMetadata } from "@/lib/seo/page-metadata";
import { normalizePreviewSkills } from "@/lib/utils/preview-skills";
import { extractCityState, normalizePrivacySettings } from "@/lib/utils/privacy";
import { parsePageParam } from "@/lib/utils/pagination";

export const revalidate = 300;

const exploreTitle = `Browse Professional Portfolios | ${siteConfig.fullName}`;

const exploreDescription =
  "Discover professionals in our community. Browse portfolios and connect with talented individuals.";

function getRoleFilter(role: string | undefined): UserRole | "freelance" | "" {
  return isUserRole(role) || role === "freelance" ? role : "";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; role?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const roleFilter = getRoleFilter(params.role);
  const page = parsePageParam(params.page);
  const canonical = new URL("/explore", siteConfig.url);

  if (page !== null) {
    if (roleFilter) canonical.searchParams.set("role", roleFilter);

    if (page > 1) canonical.searchParams.set("page", String(page));
  }

  return {
    ...buildPublicPageMetadata({
      title: "Browse Professional Portfolios",
      ogTitle: exploreTitle,
      description: exploreDescription,
      path: "/explore",
    }),
    alternates: { canonical: canonical.toString() },
    ...((roleFilter || page === null) && { robots: { index: false, follow: true } }),
  };
}

const ITEMS_PER_PAGE = 12;

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; role?: string }>;
}) {
  const params = await searchParams;
  const currentPage = parsePageParam(params.page) ?? 1;
  // "freelance" rides the same dropdown/param but filters the separate isFreelance flag.
  const roleFilter = getRoleFilter(params.role);

  const db = getDb(env.HYPERDRIVE);

  const whereConditions = [
    isNotNull(user.handle),
    eq(user.showInDirectory, true),
    eq(user.onboardingCompleted, true),
  ];

  if (roleFilter === "freelance") {
    whereConditions.push(eq(user.isFreelance, true));
  } else if (roleFilter) {
    whereConditions.push(eq(user.role, roleFilter));
  }

  // One repeatable-read snapshot keeps profile filtering and directory pagination consistent.
  const usersWithData = await db.transaction(
    async (tx) =>
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
          content: siteData.content,
        })
        .from(user)
        .innerJoin(siteData, eq(user.id, siteData.userId))
        .where(and(...whereConditions))
        .orderBy(desc(siteData.updatedAt), desc(siteData.userId)),
    { isolationLevel: "repeatable read" },
  );

  const indexableUsers = usersWithData.filter(
    (u): u is typeof u & { handle: string } =>
      u.handle !== null &&
      isIndexableProfile(u.content, normalizePrivacySettings(u.privacySettings)),
  );

  const totalCount = indexableUsers.length;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  if (currentPage > 1 && currentPage > totalPages) notFound();

  const pageUsers = indexableUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const directoryUsers: DirectoryUser[] = pageUsers.map((u) => {
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

  const exploreJsonLd = generateExploreJsonLd(
    directoryUsers.map((u) => ({
      handle: u.handle,
      name: u.previewName || "Unknown",
      headline: u.previewHeadline,
    })),
  );

  const roleOptions = [
    { value: "", label: "All Roles" },
    ...ROLE_OPTIONS,
    { value: "freelance", label: "Freelance / Contract" },
  ];

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

        {/* Cards are h3; this keeps the outline h1 → h2 → h3. */}
        <h2 className="sr-only">Professionals</h2>

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
