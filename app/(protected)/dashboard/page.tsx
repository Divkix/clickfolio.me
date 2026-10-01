import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import {
  AlertCircle,
  Award,
  Briefcase,
  Edit3,
  ExternalLink,
  GraduationCap,
  Loader2,
  Palette,
  Upload,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AnalyticsCard } from "@/components/dashboard/AnalyticsCard";
import { CopyLinkButton } from "@/components/dashboard/CopyLinkButton";
import { DashboardUploadSection } from "@/components/dashboard/DashboardUploadSection";
import { RealtimeStatusListener } from "@/components/dashboard/RealtimeStatusListener";
import { Button } from "@/components/ui/button";
import { getServerSession } from "@/lib/auth/session";
import { siteConfig } from "@/lib/config/site";
import { getDb } from "@/lib/db";
import { type Resume, resumes, type siteData, user } from "@/lib/db/schema";
import { DEFAULT_THEME, isValidThemeId, THEME_METADATA } from "@/lib/templates/theme-ids";
import type { ResumeContent } from "@/lib/types/database";
import { formatRelativeTime } from "@/lib/utils/format";
import { calculateCompleteness, getProfileSuggestions } from "@/lib/utils/profile-completeness";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function NoResumeState() {
  return (
    <div className="min-h-screen bg-background">
      <main className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="bg-card rounded-xl shadow-sm border border-border p-12 max-w-md w-full text-center transition-colors hover:border-border-strong">
          <div className="inline-flex items-center justify-center mb-6 bg-brand-subtle p-6 rounded-xl">
            <Upload className="w-12 h-12 text-brand mx-auto" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">No Resume Yet</h2>
          <p className="text-muted-foreground mb-6">
            Upload your first PDF to get started and create your professional web resume in minutes.
          </p>
          <DashboardUploadSection variant="default" className="w-full">
            <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
            Upload Your Resume
          </DashboardUploadSection>
        </div>
      </main>
    </div>
  );
}

interface ProfileCompletenessProps {
  completeness: number;
  suggestions: string[];
}

function ProfileCompleteness({ completeness, suggestions }: ProfileCompletenessProps) {
  if (completeness === 100 || suggestions.length === 0) return null;

  return (
    <div className="rounded-lg bg-surface-2 p-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-sm font-medium text-foreground">Profile {completeness}% complete</p>
        <Link href="/edit" className="text-xs font-medium text-brand hover:underline">
          Finish it
        </Link>
      </div>
      <div
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom progressbar with aria attributes; <progress> element lacks styling flexibility
        role="progressbar"
        aria-valuenow={completeness}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Profile completeness: ${completeness}%`}
        className="w-full bg-border rounded-full h-1.5 mb-3"
      >
        <div
          className="h-1.5 rounded-full bg-brand transition-[width] duration-500"
          style={{ width: `${completeness}%` }}
        />
      </div>
      <ul className="space-y-1">
        {suggestions.map((suggestion) => (
          <li key={suggestion} className="text-xs text-muted-foreground">
            {suggestion}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ResumeStatusAlertsProps {
  resumeId: string;
  status: Resume["status"];
  error?: string | null;
}

function ResumeStatusAlerts({ resumeId, status, error }: ResumeStatusAlertsProps) {
  return (
    <>
      {(status === "processing" || status === "pending_claim" || status === "queued") && (
        <div className="col-span-full">
          <RealtimeStatusListener resumeId={resumeId} currentStatus={status} />
        </div>
      )}

      {status === "failed" && (
        <div className="col-span-full">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle
                className="h-5 w-5 text-destructive shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive">Processing Failed</h3>
                <p className="mt-1 text-sm text-destructive">
                  {error || "An error occurred while processing your resume."}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button asChild size="sm">
                    <Link href={`/waiting?resume_id=${resumeId}`}>Retry</Link>
                  </Button>
                  <DashboardUploadSection />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface SiteHeroProps {
  handle: string;
  themeId: string | null;
  updatedAt: string | null;
}

function SiteHero({ handle, themeId, updatedAt }: SiteHeroProps) {
  const theme = THEME_METADATA[themeId && isValidThemeId(themeId) ? themeId : DEFAULT_THEME];

  return (
    <section
      aria-label="Your site"
      className="col-span-full bg-card rounded-xl border border-border p-5 md:p-8 flex flex-col sm:flex-row sm:items-center gap-6 md:gap-10"
    >
      <div className="flex-1 min-w-0">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 rounded-full bg-success" aria-hidden="true" />
          {updatedAt ? `Live, updated ${formatRelativeTime(updatedAt)}` : "Live"}
        </p>
        <a
          href={`/@${handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-2xl md:text-4xl font-semibold tracking-tight break-all hover:underline decoration-brand decoration-2 underline-offset-8"
        >
          <span className="text-muted-foreground">{siteConfig.domain}/</span>
          <span className="text-foreground">@{handle}</span>
        </a>
        <div className="mt-6 flex flex-wrap gap-2">
          <CopyLinkButton handle={handle} />
          <Button asChild size="sm" variant="outline">
            <a href={`/@${handle}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open site
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/themes">
              <Palette className="h-4 w-4" aria-hidden="true" />
              Change theme
            </Link>
          </Button>
        </div>
      </div>

      <Link
        href="/themes"
        className="group block w-full sm:w-64 md:w-80 shrink-0 rounded-lg border border-border overflow-hidden bg-surface-2 transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring"
      >
        <img
          src={theme.preview}
          alt={`${theme.name} theme preview`}
          className="aspect-[16/10] w-full object-cover object-top"
        />
        <span className="flex items-center justify-between px-3 py-2 text-xs border-t border-border">
          <span className="font-medium text-foreground">{theme.name}</span>
          <span className="text-muted-foreground group-hover:text-foreground">Current theme</span>
        </span>
      </Link>
    </section>
  );
}

interface ResumeCardProps {
  content: ResumeContent;
  completeness: number;
  suggestions: string[];
}

function ResumeCard({ content, completeness, suggestions }: ResumeCardProps) {
  const sections = [
    { icon: Briefcase, count: content.experience?.length ?? 0, one: "position", many: "positions" },
    { icon: GraduationCap, count: content.education?.length ?? 0, one: "school", many: "schools" },
    {
      icon: Wrench,
      count: content.skills?.reduce((n, group) => n + group.items.length, 0) ?? 0,
      one: "skill",
      many: "skills",
    },
    { icon: Award, count: content.certifications?.length ?? 0, one: "cert", many: "certs" },
  ];

  return (
    <section
      aria-label="Resume"
      className="bg-card rounded-xl border border-border p-5 md:p-6 flex flex-col gap-5"
    >
      <div>
        <h2 className="text-lg font-semibold text-foreground">{content.full_name}</h2>
        <p className="text-sm text-muted-foreground">{content.headline}</p>
      </div>

      {content.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
          {content.summary}
        </p>
      )}

      <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
        {sections.map(({ icon: Icon, count, one, many }) => (
          <li key={one} className="flex items-center gap-2 text-sm">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="font-semibold text-foreground tabular-nums">{count}</span>
            <span className="text-muted-foreground">{count === 1 ? one : many}</span>
          </li>
        ))}
      </ul>

      <ProfileCompleteness completeness={completeness} suggestions={suggestions} />

      <div className="flex flex-col gap-2 mt-auto">
        <Button asChild>
          <Link href="/edit">
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            Edit content
          </Link>
        </Button>
        <DashboardUploadSection className="w-full" />
      </div>
    </section>
  );
}

interface ResumeProcessingCardProps {
  resumeId: string;
  status: Resume["status"];
  error?: string | null;
}

function ResumeProcessingCard({ resumeId, status, error }: ResumeProcessingCardProps) {
  return (
    <div className="col-span-full">
      <div className="bg-card rounded-xl shadow-sm border border-border p-8 transition-colors hover:border-border-strong">
        {(status === "processing" || status === "pending_claim" || status === "queued") && (
          <div>
            <RealtimeStatusListener resumeId={resumeId} currentStatus={status} />
          </div>
        )}

        {status === "failed" && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-8 w-8 text-destructive shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <h3 className="text-xl font-bold text-destructive mb-1">Processing failed</h3>
                <p className="text-destructive">
                  {error || "Unknown error occurred. Please try uploading again."}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="flex-1">
                <Link href={`/waiting?resume_id=${resumeId}`}>Try Again</Link>
              </Button>
              <DashboardUploadSection />
            </div>
          </div>
        )}

        {status === "pending_claim" && (
          <div className="flex items-center gap-4">
            <Loader2
              className="h-8 w-8 animate-spin text-muted-foreground shrink-0"
              aria-hidden="true"
            />
            <div className="flex-1">
              <h3 className="text-xl font-bold text-foreground mb-1">Claiming your resume...</h3>
              <p className="text-muted-foreground">Please wait while we process your upload.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/");
  }

  const db = getDb(env.HYPERDRIVE);

  const userData = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
    with: {
      resumes: {
        orderBy: [desc(resumes.createdAt)],
        limit: 1,
      },
      siteData: {
        columns: {
          id: true,
          content: true,
          themeId: true,
          lastPublishedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    columns: {
      id: true,
      handle: true,
      name: true,
      email: true,
      image: true,
      headline: true,
      privacySettings: true,
      onboardingCompleted: true,
      createdAt: true,
    },
  });

  const profile = userData ?? null;
  // SAFETY: Drizzle query returns Resume shape for first resume; cast narrows optional relation to Resume | null for dashboard logic.
  const resume = (userData?.resumes?.[0] ?? null) as Resume | null;

  if (profile && !profile.onboardingCompleted) {
    redirect("/wizard");
  }

  if (!resume) {
    return <NoResumeState />;
  }

  // SAFETY: Drizzle query returns siteData shape via with.siteData; cast narrows optional relation to siteData select type.
  const siteDataResult = (userData?.siteData ?? null) as typeof siteData.$inferSelect | null;
  const hasPublishedSite = !!siteDataResult;
  let content: ResumeContent | null = null;

  if (siteDataResult?.content) {
    // SAFETY: content is schema-validated JSONB written by the parse pipeline and /api/resume/update; cast bridges the column's wide Record type.
    content = siteDataResult.content as ResumeContent;
  }

  const completeness = content ? calculateCompleteness(content) : 0;
  const suggestions = content ? getProfileSuggestions(content) : [];

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[1400px] mx-auto px-4 lg:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {hasPublishedSite && content ? (
            <>
              <ResumeStatusAlerts
                resumeId={resume.id}
                status={resume.status}
                error={resume.errorMessage}
              />

              {profile?.handle && (
                <SiteHero
                  handle={profile.handle}
                  themeId={siteDataResult?.themeId ?? null}
                  updatedAt={siteDataResult?.lastPublishedAt ?? siteDataResult?.updatedAt ?? null}
                />
              )}

              <div className="lg:col-span-2">
                <AnalyticsCard />
              </div>

              <ResumeCard content={content} completeness={completeness} suggestions={suggestions} />
            </>
          ) : (
            <ResumeProcessingCard
              resumeId={resume.id}
              status={resume.status}
              error={resume.errorMessage}
            />
          )}
        </div>
      </main>
    </div>
  );
}
