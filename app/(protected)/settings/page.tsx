import { getCloudflareContext } from "@opennextjs/cloudflare";
import { count, desc, eq } from "drizzle-orm";
import { User } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HandleForm } from "@/components/forms/HandleForm";
import { PrivacySettingsForm } from "@/components/forms/PrivacySettings";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";
import { ResumeManagementCard } from "@/components/settings/ResumeManagementCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { PrivacySettings } from "@/lib/db/schema";
import { resumes, user } from "@/lib/db/schema";
import { isValidPrivacySettings } from "@/lib/utils/privacy";

export default async function SettingsPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  // Fetch user profile
  const profile = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
  });

  if (!profile) {
    console.error("Failed to fetch profile for user:", session.user.id);
    redirect("/dashboard");
  }

  // Parse privacy settings from JSON string
  const parsedPrivacySettings = profile.privacySettings
    ? (JSON.parse(profile.privacySettings) as PrivacySettings)
    : null;

  // Validate and normalize privacy settings
  const privacySettings = isValidPrivacySettings(parsedPrivacySettings)
    ? parsedPrivacySettings
    : { show_phone: false, show_address: false };

  // Fetch resume count
  const resumeCountResult = await db
    .select({ count: count() })
    .from(resumes)
    .where(eq(resumes.userId, session.user.id));
  const resumeCount = resumeCountResult[0]?.count ?? 0;

  // Fetch latest resume
  const latestResume = await db.query.resumes.findFirst({
    where: eq(resumes.userId, session.user.id),
    orderBy: [desc(resumes.createdAt)],
  });

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
                    href={`/${profile.handle}`}
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
