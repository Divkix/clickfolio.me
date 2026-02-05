import { getCloudflareContext } from "@opennextjs/cloudflare";
import { desc, eq, sql } from "drizzle-orm";
import {
  AlertCircle,
  Award,
  Briefcase,
  Calendar,
  CheckCircle2,
  Edit3,
  GraduationCap,
  Link as LinkIcon,
  Loader2,
  Mail,
  Upload,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AnalyticsCard } from "@/components/dashboard/AnalyticsCard";
import { CopyLinkButton } from "@/components/dashboard/CopyLinkButton";
import { DashboardUploadSection } from "@/components/dashboard/DashboardUploadSection";
import { EmailVerificationBanner } from "@/components/dashboard/EmailVerificationBanner";
import { RealtimeStatusListener } from "@/components/dashboard/RealtimeStatusListener";
import { ReferralStats } from "@/components/dashboard/ReferralStats";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getServerSession } from "@/lib/auth/session";
import { siteConfig } from "@/lib/config/site";
import { getDb } from "@/lib/db";
import { type Resume, referralClicks, resumes, type siteData, user } from "@/lib/db/schema";
import type { ResumeContent } from "@/lib/types/database";

/**
 * Calculate profile completeness score based on available data
 */
function calculateCompleteness(content: ResumeContent): number {
  let score = 0;
  let total = 0;

  // Full name (required) - 10%
  total += 10;
  if (content.full_name?.trim()) score += 10;

  // Headline (required) - 10%
  total += 10;
  if (content.headline?.trim()) score += 10;

  // Summary (required) - 15%
  total += 15;
  if (content.summary?.trim()) score += 15;

  // Contact (required) - 10%
  total += 10;
  if (content.contact?.email) score += 10;

  // Experience (required) - 20%
  total += 20;
  if (content.experience?.length > 0) score += 20;

  // Education - 15%
  total += 15;
  if (content.education && content.education.length > 0) score += 15;

  // Skills - 10%
  total += 10;
  if (content.skills && content.skills.length > 0) score += 10;

  // Certifications - 10%
  total += 10;
  if (content.certifications && content.certifications.length > 0) score += 10;

  return Math.round((score / total) * 100);
}

/**
 * Get suggestions for improving profile
 */
function getProfileSuggestions(content: ResumeContent): string[] {
  const suggestions: string[] = [];

  if (!content.education || content.education.length === 0) {
    suggestions.push("Add your education background");
  }

  if (!content.skills || content.skills.length === 0) {
    suggestions.push("List your technical skills");
  }

  if (!content.certifications || content.certifications.length === 0) {
    suggestions.push("Add certifications to stand out");
  }

  if (content.experience.length < 2) {
    suggestions.push("Add more work experience entries");
  }

  if (!content.contact.linkedin && !content.contact.github) {
    suggestions.push("Link your professional social profiles");
  }

  return suggestions;
}

/**
 * Format relative time (e.g., "2 days ago") - deterministic to avoid hydration mismatch
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

export default async function DashboardPage() {
  // Use cached session helper to deduplicate auth calls within request
  const session = await getServerSession();

  if (!session) {
    redirect("/");
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  // Single query with relations to eliminate N+1 queries
  const userData = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
    with: {
      resumes: {
        orderBy: [desc(resumes.createdAt)],
        limit: 1,
      },
      siteData: true,
      accounts: true, // For checking OAuth vs email/password
    },
    columns: {
      id: true,
      handle: true,
      name: true,
      email: true,
      emailVerified: true, // For email verification banner
      image: true,
      headline: true,
      privacySettings: true,
      onboardingCompleted: true,
      createdAt: true,
      referralCount: true,
      referralCode: true,
    },
  });

  // Extract data from the consolidated query
  const profile = userData ?? null;
  const resume = (userData?.resumes?.[0] ?? null) as Resume | null;
  const siteDataResult = (userData?.siteData ?? null) as typeof siteData.$inferSelect | null;

  // Email verification state
  const emailVerified = userData?.emailVerified ?? false;
  const isOAuthUser = userData?.accounts?.some((a) => a.providerId === "google") ?? false;

  // Use pre-computed referralCount from user table, fetch click count separately
  const referralCount = userData?.referralCount ?? 0;
  const clickCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(referralClicks)
    .where(eq(referralClicks.referrerUserId, session.user.id));
  const clickCount = clickCountResult[0]?.count ?? 0;

  // Safety net: Redirect to wizard if onboarding is incomplete
  // This catches edge cases where users bypass the wizard flow
  if (profile && !profile.onboardingCompleted) {
    redirect("/wizard");
  }

  // Determine resume state
  const hasResume = !!resume;
  const hasPublishedSite = !!siteDataResult;
  let content: ResumeContent | null = null;
  if (siteDataResult?.content) {
    try {
      content = JSON.parse(siteDataResult.content) as ResumeContent;
    } catch (error) {
      console.error("Failed to parse siteData content:", error);
      // content remains null, dashboard will show appropriate fallback state
    }
  }

  // Calculate profile metrics
  const completeness = content ? calculateCompleteness(content) : 0;
  const suggestions = content ? getProfileSuggestions(content) : [];

  // Empty State - No Resume
  if (!hasResume) {
    return (
      // <CHANGE> bg-slate-50 -> bg-cream for neubrutalist design
      <div className="min-h-screen bg-cream">
        <main className="flex items-center justify-center min-h-[80vh] px-4">
          {/* <CHANGE> shadow-depth -> shadow-brutal, border-slate -> border-ink */}
          <div className="bg-white rounded-2xl shadow-brutal-sm border-2 border-ink/10 p-12 max-w-md w-full text-center hover:shadow-brutal-md transition-all duration-300">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-linear-to-r from-coral to-coral rounded-xl blur-xl opacity-20" />
              <div className="relative bg-linear-to-r from-coral/20 to-coral/20 p-6 rounded-xl">
                <Upload className="w-12 h-12 text-coral mx-auto" aria-hidden="true" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">No Resume Yet</h2>
            <p className="text-slate-600 mb-6">
              Upload your first PDF to get started and create your professional web resume in
              minutes.
            </p>
            <Button
              asChild
              className="w-full bg-linear-to-r from-coral to-coral hover:from-coral/90 hover:to-coral/90 text-white font-semibold transition-all duration-300 shadow-depth-sm hover:shadow-depth-md"
            >
              <Link href="/">
                <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
                Upload Your Resume
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    // <CHANGE> bg-slate-50 -> bg-cream for neubrutalist design
    <div className="min-h-screen bg-cream">
      <main className="max-w-[1400px] mx-auto px-4 lg:px-6 py-8">
        {/* Email Verification Banner (client component) */}
        {profile?.email && (
          <div className="mb-6">
            <EmailVerificationBanner
              email={profile.email}
              emailVerified={emailVerified}
              isOAuthUser={isOAuthUser}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {hasPublishedSite && content ? (
            <>
              {/* Show RealtimeStatusListener when a new resume is processing */}
              {(resume.status === "processing" || resume.status === "pending_claim") && (
                <div className="col-span-full">
                  <RealtimeStatusListener
                    resumeId={resume.id as string}
                    userId={session.user.id}
                    currentStatus={resume.status}
                  />
                </div>
              )}

              {/* Show error message when resume processing failed */}
              {resume.status === "failed" && (
                <div className="col-span-full">
                  <div className="rounded-lg border border-coral/30 bg-coral/10 p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle
                        className="h-5 w-5 text-coral shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-coral">Processing Failed</h3>
                        <p className="mt-1 text-sm text-coral">
                          {(resume.errorMessage as string | undefined | null) ||
                            "An error occurred while processing your resume."}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            asChild
                            size="sm"
                            className="bg-coral hover:bg-coral/90 text-white"
                          >
                            <Link href={`/waiting?resume_id=${resume.id}`}>Retry</Link>
                          </Button>
                          <DashboardUploadSection />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Profile Completeness - Shown at top when incomplete */}
              {completeness < 100 && suggestions.length > 0 && (
                <div className="col-span-full">
                  <Alert className="border-slate-200 bg-white rounded-2xl shadow-depth-md hover:shadow-depth-lg transition-all duration-300">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 className="h-5 w-5 text-ink" aria-hidden="true" />
                          <h3 className="font-semibold text-ink">Complete Your Profile</h3>
                        </div>

                        {/* Progress Bar */}
                        <div
                          role="progressbar"
                          aria-valuenow={completeness}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Profile completeness: ${completeness}%`}
                          className="w-full bg-slate-200 rounded-full h-2 mb-4"
                        >
                          <div
                            className="h-2 rounded-full bg-coral transition-all duration-500"
                            style={{ width: `${completeness}%` }}
                          />
                        </div>

                        <AlertDescription className="text-slate-700">
                          <p className="text-sm font-medium mb-2">
                            Your profile is {completeness}% complete. Add these to reach 100%:
                          </p>
                          <ul className="space-y-1.5">
                            {suggestions.map((suggestion, index) => (
                              <li key={index} className="text-sm flex items-start gap-2">
                                <span className="text-slate-400 mt-0.5" aria-hidden="true">
                                  •
                                </span>
                                <span>{suggestion}</span>
                              </li>
                            ))}
                          </ul>
                          <Button
                            asChild
                            size="sm"
                            className="mt-4 bg-ink hover:bg-ink/90 text-cream font-semibold"
                          >
                            <Link href="/edit">
                              <Edit3 className="h-3 w-3 mr-2" aria-hidden="true" />
                              Complete Now
                            </Link>
                          </Button>
                        </AlertDescription>
                      </div>
                    </div>
                  </Alert>
                </div>
              )}

              {/* Success Alert - Shown at top when profile is complete */}
              {completeness === 100 && (
                <div className="col-span-full">
                  <Alert className="border-green-200 bg-green-50 rounded-2xl shadow-depth-sm hover:shadow-depth-md transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
                      <AlertDescription className="text-green-900 font-medium">
                        Your profile is complete! Your resume looks professional and ready to share.
                      </AlertDescription>
                    </div>
                  </Alert>
                </div>
              )}

              {/* Left Column - Resume Preview + Referral (spans 2 on desktop) */}
              <div className="lg:col-span-2 space-y-4">
                {/* Resume Preview Card */}
                <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-4 md:p-6 lg:p-8 hover:shadow-depth-md hover:-translate-y-0.5 transition-shadow duration-300">
                  {/* Header */}
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">{content.full_name}</h2>
                    <p className="text-base text-slate-600 mt-1">{content.headline}</p>
                  </div>

                  <Separator className="mb-6" />

                  {/* Summary */}
                  {content.summary && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">Summary</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {truncateText(content.summary, 200)}
                        {content.summary.length > 200 && (
                          <Link
                            href="/edit"
                            className="text-coral hover:text-coral ml-1 font-medium"
                          >
                            Read more
                          </Link>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="absolute inset-0 bg-linear-to-r from-coral to-coral rounded-lg blur-md opacity-20" />
                        <div className="relative bg-linear-to-r from-coral/20 to-coral/20 p-2 rounded-lg">
                          <Briefcase className="h-4 w-4 text-coral" aria-hidden="true" />
                        </div>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-slate-900">
                          {content.experience?.length || 0}
                        </p>
                        <p className="text-xs text-slate-600">
                          Position{content.experience?.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="absolute inset-0 bg-linear-to-r from-purple-500 to-pink-500 rounded-lg blur-md opacity-20" />
                        <div className="relative bg-linear-to-r from-purple-100 to-pink-100 p-2 rounded-lg">
                          <GraduationCap className="h-4 w-4 text-purple-600" aria-hidden="true" />
                        </div>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-slate-900">
                          {content.education?.length || 0}
                        </p>
                        <p className="text-xs text-slate-600">Education</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="absolute inset-0 bg-linear-to-r from-emerald-500 to-teal-500 rounded-lg blur-md opacity-20" />
                        <div className="relative bg-linear-to-r from-emerald-100 to-teal-100 p-2 rounded-lg">
                          <Wrench className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                        </div>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-slate-900">
                          {content.skills?.length || 0}
                        </p>
                        <p className="text-xs text-slate-600">
                          Skill{content.skills?.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="absolute inset-0 bg-linear-to-r from-orange-500 to-amber-500 rounded-lg blur-md opacity-20" />
                        <div className="relative bg-linear-to-r from-orange-100 to-amber-100 p-2 rounded-lg">
                          <Award className="h-4 w-4 text-orange-600" aria-hidden="true" />
                        </div>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-slate-900">
                          {content.certifications?.length || 0}
                        </p>
                        {content.certifications?.length === 0 ? (
                          <Link
                            href="/edit"
                            className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                          >
                            Add certs
                          </Link>
                        ) : (
                          <p className="text-xs text-slate-600">Certs</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator className="mb-6" />

                  {/* Footer - Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      asChild
                      className="flex-1 bg-linear-to-r from-coral to-coral hover:from-coral/90 hover:to-coral/90 text-white font-semibold transition-colors duration-300 shadow-depth-sm hover:shadow-depth-md"
                    >
                      <Link href="/edit">
                        <Edit3 className="h-4 w-4 mr-2" aria-hidden="true" />
                        Edit Content
                      </Link>
                    </Button>
                    <DashboardUploadSection />
                  </div>
                </div>

                {/* Referral CTA - Now prominent in left column */}
                {profile?.referralCode && (
                  <ReferralStats
                    referralCount={referralCount}
                    clickCount={clickCount}
                    referralCode={profile.referralCode}
                  />
                )}
              </div>

              {/* Right Column - Account + Analytics */}
              <div className="space-y-4">
                {/* Account Info Card */}
                <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6 hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Account</h3>
                  <div className="space-y-4">
                    {/* Email */}
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0 mt-0.5">
                        <div className="absolute inset-0 bg-linear-to-r from-coral to-coral rounded-lg blur-md opacity-20" />
                        <div className="relative bg-linear-to-r from-coral/20 to-coral/20 p-2 rounded-lg">
                          <Mail className="w-4 h-4 text-coral" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-600 mb-1">Email</p>
                        <p className="text-sm text-slate-900 truncate">{session.user.email}</p>
                      </div>
                    </div>

                    {/* Handle */}
                    {profile?.handle && (
                      <>
                        <Separator />
                        <div className="flex items-start gap-3">
                          <div className="relative shrink-0 mt-0.5">
                            <div className="absolute inset-0 bg-linear-to-r from-coral to-coral rounded-lg blur-md opacity-20" />
                            <div className="relative bg-linear-to-r from-coral/20 to-coral/20 p-2 rounded-lg">
                              <LinkIcon className="w-4 h-4 text-coral" aria-hidden="true" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-600 mb-1">Handle</p>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/@${profile.handle}`}
                                className="text-sm text-coral hover:text-coral font-medium truncate block"
                              >
                                {siteConfig.domain}/@{profile.handle}
                              </Link>
                            </div>
                            <div className="mt-2">
                              <CopyLinkButton handle={profile.handle} />
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Member Since */}
                    {profile?.createdAt && (
                      <>
                        <Separator />
                        <div className="flex items-start gap-3">
                          <div className="relative shrink-0 mt-0.5">
                            <div className="absolute inset-0 bg-linear-to-r from-coral to-coral rounded-lg blur-md opacity-20" />
                            <div className="relative bg-linear-to-r from-coral/20 to-coral/20 p-2 rounded-lg">
                              <Calendar className="w-4 h-4 text-coral" aria-hidden="true" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-600 mb-1">Member since</p>
                            <p className="text-sm text-slate-900">
                              {formatRelativeTime(profile.createdAt)}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Analytics Card */}
                <AnalyticsCard />
              </div>
            </>
          ) : (
            /* Show processing/failed state in main content area */
            <div className="col-span-full">
              <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-8 hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
                {(resume.status === "processing" || resume.status === "pending_claim") && (
                  <div>
                    <RealtimeStatusListener
                      resumeId={resume.id as string}
                      userId={session.user.id}
                      currentStatus={resume.status}
                    />
                  </div>
                )}

                {resume.status === "failed" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <AlertCircle className="h-8 w-8 text-coral shrink-0" aria-hidden="true" />
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-coral mb-1">Processing failed</h3>
                        <p className="text-coral">
                          {(resume.errorMessage as string | undefined | null) ||
                            "Unknown error occurred. Please try uploading again."}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        asChild
                        className="flex-1 bg-linear-to-r from-coral to-coral hover:from-coral/90 hover:to-coral/90 text-white font-semibold transition-all duration-300 shadow-depth-sm hover:shadow-depth-md"
                      >
                        <Link href={`/waiting?resume_id=${resume.id}`}>Try Again</Link>
                      </Button>
                      <DashboardUploadSection />
                    </div>
                  </div>
                )}

                {resume.status === "pending_claim" && (
                  <div className="flex items-center gap-4">
                    <Loader2
                      className="h-8 w-8 animate-spin text-slate-600 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-slate-900 mb-1">
                        Claiming your resume...
                      </h3>
                      <p className="text-slate-600">Please wait while we process your upload.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
