import { getCloudflareContext } from "@opennextjs/cloudflare";
import { desc, eq } from "drizzle-orm";
import {
  AlertCircle,
  Award,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
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
import { RealtimeStatusListener } from "@/components/dashboard/RealtimeStatusListener";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getServerSession } from "@/lib/auth/session";
import { siteConfig } from "@/lib/config/site";
import { getDb } from "@/lib/db";
import { type Resume, resumes, type siteData, user } from "@/lib/db/schema";
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

  // Extract data from the consolidated query
  const profile = userData ?? null;
  const resume = (userData?.resumes?.[0] ?? null) as Resume | null;
  const siteDataResult = (userData?.siteData ?? null) as typeof siteData.$inferSelect | null;

  // Safety net: Redirect to wizard if onboarding is incomplete
  // This catches edge cases where users bypass the wizard flow
  if (profile && !profile.onboardingCompleted) {
    redirect("/wizard");
  }

  // Determine resume state
  const hasResume = !!resume;
  const hasPublishedSite = !!siteDataResult;
  const content = siteDataResult?.content
    ? (JSON.parse(siteDataResult.content) as ResumeContent)
    : null;

  // Calculate profile metrics
  const completeness = content ? calculateCompleteness(content) : 0;
  const suggestions = content ? getProfileSuggestions(content) : [];

  // Empty State - No Resume
  if (!hasResume) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="flex items-center justify-center min-h-[80vh] px-4">
          <div className="bg-white rounded-2xl shadow-depth-md border border-slate-200/60 p-12 max-w-md w-full text-center hover:shadow-depth-lg transition-all duration-300">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-blue-500 rounded-xl blur-xl opacity-20" />
              <div className="relative bg-linear-to-r from-indigo-100 to-blue-100 p-6 rounded-xl">
                <Upload className="w-12 h-12 text-indigo-600 mx-auto" aria-hidden="true" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">No Resume Yet</h2>
            <p className="text-slate-600 mb-6">
              Upload your first PDF to get started and create your professional web resume in
              minutes.
            </p>
            <Button
              asChild
              className="w-full bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold transition-all duration-300 shadow-depth-sm hover:shadow-depth-md"
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
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-[1400px] mx-auto px-4 lg:px-6 py-8">
        {/* Onboarding Incomplete Banner */}
        {profile && !profile.onboardingCompleted && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertCircle className="w-4 h-4 text-amber-600" aria-hidden="true" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-amber-900 font-medium">
                Your profile is incomplete. Complete the wizard to improve your resume.
              </span>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="ml-4 border-amber-300 text-amber-700 hover:bg-amber-100 hover:border-amber-400"
              >
                <Link href="/wizard">Complete Now</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Row 1: Hero Stats - Full Width */}
          <div className="col-span-full">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Resume Status Mini Card */}
              <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-4 hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div
                      className={`absolute inset-0 rounded-xl blur-lg opacity-20 ${
                        resume.status === "completed"
                          ? "bg-linear-to-r from-green-500 to-emerald-500"
                          : resume.status === "processing"
                            ? "bg-linear-to-r from-blue-500 to-cyan-500"
                            : resume.status === "failed"
                              ? "bg-linear-to-r from-red-500 to-orange-500"
                              : "bg-linear-to-r from-slate-500 to-gray-500"
                      }`}
                    />
                    <div
                      className={`relative p-2 rounded-xl ${
                        resume.status === "completed"
                          ? "bg-linear-to-r from-green-100 to-emerald-100"
                          : resume.status === "processing"
                            ? "bg-linear-to-r from-blue-100 to-cyan-100"
                            : resume.status === "failed"
                              ? "bg-linear-to-r from-red-100 to-orange-100"
                              : "bg-linear-to-r from-slate-100 to-gray-100"
                      }`}
                    >
                      {resume.status === "completed" && (
                        <CheckCircle2 className="w-5 h-5 text-green-600" aria-hidden="true" />
                      )}
                      {resume.status === "processing" && (
                        <Loader2
                          className="w-5 h-5 text-blue-600 animate-spin"
                          aria-hidden="true"
                        />
                      )}
                      {resume.status === "failed" && (
                        <AlertCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
                      )}
                      {resume.status === "pending_claim" && (
                        <Loader2
                          className="w-5 h-5 text-slate-600 animate-spin"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-600 mb-1">Resume Status</p>
                    <Badge
                      className={
                        resume.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : resume.status === "processing"
                            ? "bg-blue-100 text-blue-800"
                            : resume.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-slate-100 text-slate-800"
                      }
                    >
                      {resume.status === "completed"
                        ? "Published"
                        : resume.status === "processing"
                          ? "Processing"
                          : resume.status === "failed"
                            ? "Failed"
                            : "Pending"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Profile Completeness Mini Card */}
              {hasPublishedSite && content && (
                <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-4 hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div
                        className={`absolute inset-0 rounded-xl blur-lg opacity-20 ${
                          completeness >= 90
                            ? "bg-linear-to-r from-green-500 to-emerald-500"
                            : completeness >= 70
                              ? "bg-linear-to-r from-blue-500 to-cyan-500"
                              : "bg-linear-to-r from-yellow-500 to-amber-500"
                        }`}
                      />
                      <div
                        className={`relative p-2 rounded-xl ${
                          completeness >= 90
                            ? "bg-linear-to-r from-green-100 to-emerald-100"
                            : completeness >= 70
                              ? "bg-linear-to-r from-blue-100 to-cyan-100"
                              : "bg-linear-to-r from-yellow-100 to-amber-100"
                        }`}
                      >
                        <div
                          role="img"
                          aria-label={`Profile completeness: ${completeness}%`}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                            completeness >= 90
                              ? "border-green-600 text-green-600"
                              : completeness >= 70
                                ? "border-blue-600 text-blue-600"
                                : "border-yellow-600 text-yellow-600"
                          }`}
                        >
                          <span aria-hidden="true">{Math.round(completeness / 10)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-600 mb-1">Completeness</p>
                      <p
                        className={`text-lg font-bold ${
                          completeness >= 90
                            ? "text-green-600"
                            : completeness >= 70
                              ? "text-blue-600"
                              : "text-yellow-600"
                        }`}
                      >
                        {completeness}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Last Updated Mini Card */}
              {hasPublishedSite && siteDataResult?.lastPublishedAt && (
                <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-4 hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-blue-500 rounded-xl blur-lg opacity-20" />
                      <div className="relative bg-linear-to-r from-indigo-100 to-blue-100 p-2 rounded-xl">
                        <Clock className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-600 mb-1">Last Updated</p>
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {formatRelativeTime(siteDataResult.lastPublishedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Stat - Experience Count or View Site Link */}
              {hasPublishedSite && profile?.handle ? (
                <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-4 hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-blue-500 rounded-xl blur-lg opacity-20" />
                      <div className="relative bg-linear-to-r from-indigo-100 to-blue-100 p-2 rounded-xl">
                        <ExternalLink className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-600 mb-1">Your Resume</p>
                      <Link
                        href={`/${profile.handle}`}
                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 truncate block"
                      >
                        View Site
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                content && (
                  <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-4 hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-blue-500 rounded-xl blur-lg opacity-20" />
                        <div className="relative bg-linear-to-r from-indigo-100 to-blue-100 p-2 rounded-xl">
                          <Briefcase className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-600 mb-1">Experience</p>
                        <p className="text-lg font-bold text-slate-900">
                          {content.experience?.length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Row 2: Main Content Area */}
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
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle
                        className="h-5 w-5 text-red-600 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-red-900">Processing Failed</h3>
                        <p className="mt-1 text-sm text-red-700">
                          {(resume.errorMessage as string | undefined | null) ||
                            "An error occurred while processing your resume."}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            asChild
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white"
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

              {/* Left Column - Resume Preview (spans 2 on desktop) */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-8 hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
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
                          className="text-indigo-600 hover:text-indigo-700 ml-1 font-medium"
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
                      <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-blue-500 rounded-lg blur-md opacity-20" />
                      <div className="relative bg-linear-to-r from-indigo-100 to-blue-100 p-2 rounded-lg">
                        <Briefcase className="h-4 w-4 text-indigo-600" aria-hidden="true" />
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
                      <p className="text-xs text-slate-600">Certs</p>
                    </div>
                  </div>
                </div>

                <Separator className="mb-6" />

                {/* Footer - Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    asChild
                    className="flex-1 bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold transition-all duration-300 shadow-depth-sm hover:shadow-depth-md"
                  >
                    <Link href="/edit">
                      <Edit3 className="h-4 w-4 mr-2" aria-hidden="true" />
                      Edit Content
                    </Link>
                  </Button>
                  <DashboardUploadSection />
                </div>
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
                        <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-blue-500 rounded-lg blur-md opacity-20" />
                        <div className="relative bg-linear-to-r from-indigo-100 to-blue-100 p-2 rounded-lg">
                          <Mail className="w-4 h-4 text-indigo-600" aria-hidden="true" />
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
                            <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-blue-500 rounded-lg blur-md opacity-20" />
                            <div className="relative bg-linear-to-r from-indigo-100 to-blue-100 p-2 rounded-lg">
                              <LinkIcon className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-600 mb-1">Handle</p>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/${profile.handle}`}
                                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium truncate block"
                              >
                                {siteConfig.domain}/{profile.handle}
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
                            <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-blue-500 rounded-lg blur-md opacity-20" />
                            <div className="relative bg-linear-to-r from-indigo-100 to-blue-100 p-2 rounded-lg">
                              <Calendar className="w-4 h-4 text-indigo-600" aria-hidden="true" />
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
                      <AlertCircle className="h-8 w-8 text-red-600 shrink-0" aria-hidden="true" />
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-red-900 mb-1">Processing failed</h3>
                        <p className="text-red-700">
                          {(resume.errorMessage as string | undefined | null) ||
                            "Unknown error occurred. Please try uploading again."}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        asChild
                        className="flex-1 bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold transition-all duration-300 shadow-depth-sm hover:shadow-depth-md"
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

          {/* Row 3: Profile Completeness Suggestions (Conditional, Full Width) */}
          {hasPublishedSite && content && completeness < 100 && suggestions.length > 0 && (
            <div className="col-span-full">
              <Alert className="border-blue-200 bg-blue-50 rounded-2xl shadow-depth-sm hover:shadow-depth-md transition-all duration-300">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
                      <h3 className="font-semibold text-blue-900">Complete Your Profile</h3>
                    </div>

                    {/* Progress Bar */}
                    <div
                      role="progressbar"
                      aria-valuenow={completeness}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Profile completeness: ${completeness}%`}
                      className="w-full bg-blue-200 rounded-full h-2 mb-4"
                    >
                      <div
                        className="h-2 rounded-full bg-linear-to-r from-indigo-600 to-blue-600 transition-all duration-500"
                        style={{ width: `${completeness}%` }}
                      />
                    </div>

                    <AlertDescription className="text-blue-900">
                      <p className="text-sm font-medium mb-2">
                        Your profile is {completeness}% complete. Add these to reach 100%:
                      </p>
                      <ul className="space-y-1.5">
                        {suggestions.map((suggestion, index) => (
                          <li key={index} className="text-sm flex items-start gap-2">
                            <span className="text-blue-600 mt-0.5" aria-hidden="true">
                              •
                            </span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        asChild
                        size="sm"
                        className="mt-4 bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold"
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

          {/* Row 3: Success Alert (when completeness = 100) */}
          {hasPublishedSite && completeness === 100 && (
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
        </div>
      </main>
    </div>
  );
}
