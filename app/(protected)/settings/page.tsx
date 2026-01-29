import { getCloudflareContext } from "@opennextjs/cloudflare";
import { count, desc, eq, sql } from "drizzle-orm";
import { User } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HandleForm } from "@/components/forms/HandleForm";
import { PrivacySettingsForm } from "@/components/forms/PrivacySettings";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";
import { ResumeManagementCard } from "@/components/settings/ResumeManagementCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { resumes, user } from "@/lib/db/schema";
import { isValidPrivacySettings, normalizePrivacySettings } from "@/lib/utils/privacy";

export default async function SettingsPage() {
  // Use cached session helper to deduplicate auth calls within request
  const session = await getServerSession();

  if (!session) {
    redirect("/");
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  // Run profile and resume queries in parallel to reduce roundtrips
  const [profile, resumeData] = await Promise.all([
    // Fetch user profile with only needed columns
    db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: {
        id: true,
        email: true,
        handle: true,
        headline: true,
        image: true,
        privacySettings: true,
      },
    }),
    // Combined resume query: count + latest in single roundtrip
    db
      .select({
        count: count(),
        latestId: sql<string | null>`MAX(${resumes.id})`,
        latestCreatedAt: sql<string | null>`MAX(${resumes.createdAt})`,
      })
      .from(resumes)
      .where(eq(resumes.userId, session.user.id)),
  ]);

  if (!profile) {
    console.error("Failed to fetch profile for user:", session.user.id);
    redirect("/dashboard");
  }

  // Parse privacy settings from JSON string
  let parsedPrivacySettings: {
    show_phone: boolean;
    show_address: boolean;
    hide_from_search?: boolean;
  } | null = null;
  try {
    parsedPrivacySettings = profile.privacySettings ? JSON.parse(profile.privacySettings) : null;
  } catch {
    parsedPrivacySettings = null;
  }

  // Validate and normalize privacy settings (with backward compatibility)
  const privacySettings = normalizePrivacySettings(
    isValidPrivacySettings(parsedPrivacySettings) ? parsedPrivacySettings : null,
  );

  const resumeCount = resumeData[0]?.count ?? 0;

  // Fetch latest resume details only if there are resumes (conditional query)
  const latestResume =
    resumeCount > 0
      ? await db.query.resumes.findFirst({
          where: eq(resumes.userId, session.user.id),
          orderBy: [desc(resumes.createdAt)],
          columns: {
            id: true,
            createdAt: true,
            status: true,
            errorMessage: true,
          },
        })
      : null;

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-5xl mx-auto px-4 lg:px-6 space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600 mt-2">Manage your account and privacy settings</p>
        </div>

        {/* Profile Overview */}
        <Card className="shadow-depth-sm border-slate-200/60 hover:shadow-depth-md transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <User className="h-5 w-5 text-indigo-600" />
              Profile Information
            </CardTitle>
            <CardDescription className="text-slate-600">
              Your account details and basic information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-700">Email</p>
                <p className="text-sm text-slate-900">{profile.email}</p>
              </div>
              {profile.handle && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-700">Handle</p>
                  <Link
                    href={`/@${profile.handle}`}
                    className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline font-mono transition-colors duration-300"
                  >
                    @{profile.handle}
                  </Link>
                </div>
              )}
            </div>

            {profile.headline && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-700">Headline</p>
                <p className="text-sm text-slate-900">{profile.headline}</p>
              </div>
            )}

            {profile.image && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Avatar</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.image}
                  alt="Profile avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-slate-200/60"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resume Management */}
        <ResumeManagementCard
          resumeCount={resumeCount}
          latestResumeDate={(latestResume?.createdAt as string | undefined) ?? undefined}
          latestResumeStatus={latestResume?.status as string | undefined | null}
          latestResumeError={(latestResume?.errorMessage as string | undefined | null) ?? undefined}
          latestResumeId={latestResume?.id as string}
        />

        {/* Handle Management */}
        {profile.handle && <HandleForm currentHandle={profile.handle} />}

        {/* Privacy Settings */}
        <PrivacySettingsForm initialSettings={privacySettings} userHandle={profile.handle} />

        {/* Danger Zone - Account Deletion */}
        <DeleteAccountCard userEmail={profile.email} />
      </div>
    </div>
  );
}
