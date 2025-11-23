import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { User } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PrivacySettingsForm } from "@/components/forms/PrivacySettings";
import { HandleForm } from "@/components/forms/HandleForm";
import { ResumeManagementCard } from "@/components/settings/ResumeManagementCard";
import { isValidPrivacySettings } from "@/lib/utils/privacy";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Fetch user profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, handle, email, avatar_url, headline, privacy_settings")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    console.error("Failed to fetch profile:", error);
    redirect("/dashboard");
  }

  // Validate and normalize privacy settings
  const privacySettings = isValidPrivacySettings(profile.privacy_settings)
    ? profile.privacy_settings
    : { show_phone: false, show_address: false };

  // Fetch resume data for management section
  const { count: resumeCount } = await supabase
    .from("resumes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data: latestResume } = await supabase
    .from("resumes")
    .select("id, status, created_at, error_message")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-5xl mx-auto px-4 lg:px-6 space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600 mt-2">
            Manage your account and privacy settings
          </p>
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

            {profile.avatar_url && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Avatar</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.avatar_url}
                  alt="Profile avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-slate-200/60"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resume Management */}
        <ResumeManagementCard
          resumeCount={resumeCount || 0}
          latestResumeDate={latestResume?.created_at}
          latestResumeStatus={latestResume?.status}
          latestResumeError={latestResume?.error_message}
          latestResumeId={latestResume?.id}
        />

        {/* Handle Management */}
        {profile.handle && <HandleForm currentHandle={profile.handle} />}

        {/* Privacy Settings */}
        <PrivacySettingsForm
          initialSettings={privacySettings}
          userHandle={profile.handle}
        />

        {/* Danger Zone */}
        <Card className="shadow-depth-sm border-red-200 hover:shadow-depth-md transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-red-900">Danger Zone</CardTitle>
            <CardDescription className="text-red-700">
              Irreversible actions for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-900">
                Account deletion and data export features coming soon.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
