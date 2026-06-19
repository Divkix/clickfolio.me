import { env } from "cloudflare:workers";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { Briefcase, ExternalLink, GraduationCap, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RoleFilterSelect } from "@/components/explore/role-filter-select";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";
import { getDb } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";
import { ROLE_OPTIONS } from "@/lib/schemas/profile";
import {
  generateExploreJsonLd,
  generatePageBreadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { parsePreviewSkills } from "@/lib/utils/preview-skills";

/** Revalidate explore page every 5 minutes for directory freshness. */
export const revalidate = 300;

const exploreTitle = `Browse Professional Portfolios | ${siteConfig.fullName}`;
const exploreDescription =
  "Discover professionals in our community. Browse portfolios and connect with talented individuals.";

/** SEO metadata for the explore directory page. */
export const metadata: Metadata = {
  title: "Browse Professional Portfolios",
  description: exploreDescription,
  alternates: {
    canonical: `${siteConfig.url}/explore`,
  },
  openGraph: {
    title: exploreTitle,
    description: exploreDescription,
    url: `${siteConfig.url}/explore`,
    siteName: siteConfig.fullName,
    images: [{ url: "/api/og/home", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: exploreTitle,
    description: exploreDescription,
  },
};

/** Shape of a user entry in the public directory. */
interface DirectoryUser {
  handle: string;
  role: string | null;
  previewName: string | null;
  previewHeadline: string | null;
  previewLocation: string | null;
  previewExpCount: number | null;
  previewEduCount: number | null;
  previewSkills: string[] | null;
}

const ITEMS_PER_PAGE = 12;

/**
 * Explore directory — paginated, filterable listing of public portfolios.
 * Fetches preview columns from the database for fast rendering.
 */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; role?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, Number.parseInt(params.page || "1", 10));
  const roleFilter = params.role || "";

  const db = getDb(env.CLICKFOLIO_DB);

  // Build where conditions
  const whereConditions = [
    isNotNull(user.handle),
    // Denormalized boolean column — indexed, no json_extract() needed
    eq(user.showInDirectory, true),
    // Must have completed onboarding
    eq(user.onboardingCompleted, true),
  ];

  // Add role filter if specified
  if (roleFilter) {
    whereConditions.push(eq(user.role, roleFilter as (typeof user.role.enumValues)[number]));
  }

  // Run count and data queries in parallel (independent D1 reads)
  const [countResult, usersWithData] = await Promise.all([
    // Total count for pagination
    db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .innerJoin(siteData, eq(user.id, siteData.userId))
      .where(and(...whereConditions)),

    // Paginated users with their site data preview columns
    db
      .select({
        handle: user.handle,
        role: user.role,
        previewName: siteData.previewName,
        previewHeadline: siteData.previewHeadline,
        previewLocation: siteData.previewLocation,
        previewExpCount: siteData.previewExpCount,
        previewEduCount: siteData.previewEduCount,
        previewSkills: siteData.previewSkills,
      })
      .from(user)
      .innerJoin(siteData, eq(user.id, siteData.userId))
      .where(and(...whereConditions))
      .orderBy(desc(siteData.updatedAt))
      .limit(ITEMS_PER_PAGE)
      .offset((currentPage - 1) * ITEMS_PER_PAGE),
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const directoryUsers: DirectoryUser[] = usersWithData
    .filter((u) => u.handle !== null)
    .map((u) => {
      const previewSkills = parsePreviewSkills(u.previewSkills);

      return {
        handle: u.handle as string,
        role: u.role,
        previewName: u.previewName,
        previewHeadline: u.previewHeadline,
        previewLocation: u.previewLocation,
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
  const exploreBreadcrumb = generatePageBreadcrumbJsonLd("Explore Professionals", "/explore");

  // Role options for filter (shared constant from profile schema)
  const roleOptions = [{ value: "", label: "All Roles" }, ...ROLE_OPTIONS];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(exploreJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(exploreBreadcrumb) }}
      />
      {/* Pagination hints for crawlers */}
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
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight mb-4">
            Explore Professionals
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover talented professionals in our community. Browse portfolios and get inspired.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <label htmlFor="role-filter" className="text-sm font-medium text-foreground">
              Filter by role:
            </label>
            <RoleFilterSelect roleFilter={roleFilter} roleOptions={roleOptions} />
          </div>
          <p className="text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? "professional" : "professionals"} listed
          </p>
        </div>

        {/* Grid of users */}
        {directoryUsers.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border shadow-sm">
            <p className="text-muted-foreground text-lg">
              No professionals found.{" "}
              {roleFilter && (
                <Link href="/explore" className="text-brand hover:underline">
                  Clear filters
                </Link>
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {directoryUsers.map((person) => (
              <Link
                key={person.handle}
                href={`/@${person.handle}`}
                className="group bg-card rounded-xl border border-border shadow-sm p-6 transition-colors hover:border-border-strong hover:bg-surface-2"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-foreground truncate group-hover:text-brand transition-colors">
                      {person.previewName || "Unknown"}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {person.previewHeadline || "Professional"}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-brand shrink-0 ml-2" />
                </div>

                {/* Quick stats */}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {person.previewLocation && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {person.previewLocation.split(",")[0]}
                    </span>
                  )}
                  {person.previewExpCount != null && person.previewExpCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      {person.previewExpCount}{" "}
                      {person.previewExpCount === 1 ? "position" : "positions"}
                    </span>
                  )}
                  {person.previewEduCount != null && person.previewEduCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <GraduationCap className="w-3 h-3" />
                      {person.previewEduCount}
                    </span>
                  )}
                </div>

                {/* Skills preview */}
                {person.previewSkills && person.previewSkills.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {person.previewSkills.slice(0, 4).map((skill, idx) => (
                      <Badge key={`${skill}-${idx}`} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                    {person.previewSkills.length > 4 && (
                      <span className="inline-block px-1 py-0.5 text-muted-foreground text-xs">
                        +{person.previewSkills.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-2">
            {currentPage > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/explore?page=${currentPage - 1}${roleFilter ? `&role=${roleFilter}` : ""}`}
                >
                  Previous
                </Link>
              </Button>
            )}

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1,
                )
                .map((page, index, arr) => {
                  // Add ellipsis if there's a gap
                  const showEllipsis = index > 0 && page - arr[index - 1] > 1;
                  return (
                    <span key={page} className="contents">
                      {showEllipsis && <span className="px-2 text-muted-foreground">...</span>}
                      <Button
                        asChild
                        variant={page === currentPage ? "default" : "outline"}
                        size="icon"
                      >
                        <Link
                          href={`/explore?page=${page}${roleFilter ? `&role=${roleFilter}` : ""}`}
                          aria-current={page === currentPage ? "page" : undefined}
                        >
                          {page}
                        </Link>
                      </Button>
                    </span>
                  );
                })}
            </div>

            {currentPage < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/explore?page=${currentPage + 1}${roleFilter ? `&role=${roleFilter}` : ""}`}
                >
                  Next
                </Link>
              </Button>
            )}
          </div>
        )}

        {/* CTA for non-listed users */}
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
