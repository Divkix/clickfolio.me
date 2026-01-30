import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { Briefcase, ExternalLink, GraduationCap, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";
import { getDb } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: `Explore Professionals | ${siteConfig.fullName}`,
  description:
    "Discover professionals in our community. Browse portfolios and connect with talented individuals.",
  openGraph: {
    title: `Explore Professionals | ${siteConfig.fullName}`,
    description:
      "Discover professionals in our community. Browse portfolios and connect with talented individuals.",
  },
};

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

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; role?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, Number.parseInt(params.page || "1", 10));
  const roleFilter = params.role || "";

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  // Build where conditions
  const whereConditions = [
    isNotNull(user.handle),
    // Filter for users who opted into directory
    // Privacy settings are stored as JSON TEXT, so we use LIKE to check
    sql`json_extract(${user.privacySettings}, '$.show_in_directory') = 1`,
    // Must have completed onboarding
    eq(user.onboardingCompleted, true),
  ];

  // Add role filter if specified
  if (roleFilter) {
    whereConditions.push(eq(user.role, roleFilter as (typeof user.role.enumValues)[number]));
  }

  // Get total count for pagination
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(user)
    .innerJoin(siteData, eq(user.id, siteData.userId))
    .where(and(...whereConditions));

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Get paginated users with their site data preview columns
  const usersWithData = await db
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
    .offset((currentPage - 1) * ITEMS_PER_PAGE);

  const directoryUsers: DirectoryUser[] = usersWithData
    .filter((u) => u.handle !== null)
    .map((u) => ({
      handle: u.handle as string,
      role: u.role,
      previewName: u.previewName,
      previewHeadline: u.previewHeadline,
      previewLocation: u.previewLocation,
      previewExpCount: u.previewExpCount,
      previewEduCount: u.previewEduCount,
      previewSkills: u.previewSkills ? (JSON.parse(u.previewSkills) as string[]) : null,
    }));

  // Role options for filter
  const roleOptions = [
    { value: "", label: "All Roles" },
    { value: "student", label: "Student" },
    { value: "recent_graduate", label: "Recent Graduate" },
    { value: "junior_professional", label: "Junior Professional" },
    { value: "mid_level_professional", label: "Mid-Level Professional" },
    { value: "senior_professional", label: "Senior Professional" },
    { value: "freelancer", label: "Freelancer" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Explore Professionals
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Discover talented professionals in our community. Browse portfolios and get inspired.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <label htmlFor="role-filter" className="text-sm font-medium text-slate-700">
              Filter by role:
            </label>
            <form action="/explore" method="get">
              <select
                id="role-filter"
                name="role"
                defaultValue={roleFilter}
                onChange={(e) => (e.target as HTMLSelectElement).form?.submit()}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </form>
          </div>
          <p className="text-sm text-slate-500">
            {totalCount} {totalCount === 1 ? "professional" : "professionals"} listed
          </p>
        </div>

        {/* Grid of users */}
        {directoryUsers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/60">
            <p className="text-slate-600 text-lg">
              No professionals found.{" "}
              {roleFilter && (
                <Link href="/explore" className="text-indigo-600 hover:underline">
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
                className="group bg-white rounded-2xl border border-slate-200/60 p-6 hover:shadow-lg hover:border-indigo-200 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                      {person.previewName || "Unknown"}
                    </h3>
                    <p className="text-sm text-slate-600 truncate">
                      {person.previewHeadline || "Professional"}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 shrink-0 ml-2" />
                </div>

                {/* Quick stats */}
                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
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
                  <div className="mt-4 flex flex-wrap gap-1">
                    {person.previewSkills.slice(0, 4).map((skill, idx) => (
                      <span
                        key={`${skill}-${idx}`}
                        className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-md"
                      >
                        {skill}
                      </span>
                    ))}
                    {person.previewSkills.length > 4 && (
                      <span className="inline-block px-2 py-0.5 text-slate-400 text-xs">
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
              <Link
                href={`/explore?page=${currentPage - 1}${roleFilter ? `&role=${roleFilter}` : ""}`}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Previous
              </Link>
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
                      {showEllipsis && <span className="px-2 text-slate-400">...</span>}
                      <Link
                        href={`/explore?page=${page}${roleFilter ? `&role=${roleFilter}` : ""}`}
                        className={`w-10 h-10 flex items-center justify-center text-sm font-medium rounded-lg ${
                          page === currentPage
                            ? "bg-indigo-600 text-white"
                            : "text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {page}
                      </Link>
                    </span>
                  );
                })}
            </div>

            {currentPage < totalPages && (
              <Link
                href={`/explore?page=${currentPage + 1}${roleFilter ? `&role=${roleFilter}` : ""}`}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Next
              </Link>
            )}
          </div>
        )}

        {/* CTA for non-listed users */}
        <div className="mt-16 text-center bg-linear-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Join Our Directory</h2>
          <p className="text-slate-600 mb-6 max-w-xl mx-auto">
            Want to be featured here? Enable &ldquo;Show in Directory&rdquo; in your privacy
            settings to get discovered by recruiters and collaborators.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Update Privacy Settings
          </Link>
        </div>
      </main>
    </div>
  );
}
