import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { User } from "lucide-react";
import { HandleForm } from "@/components/forms/HandleForm";
import { PrivacySettingsForm } from "@/components/forms/PrivacySettings";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";
import { ResumeManagementCard } from "@/components/settings/ResumeManagementCard";
import { RoleSelectorCard } from "@/components/settings/RoleSelectorCard";
import { Separator } from "@/components/ui/separator";
import { ProtectedError } from "@/components/errors/ProtectedError";
import { settingsPageData } from "@/lib/data/owner-pages";
import { privatePageHead } from "@/lib/seo/page-metadata";
import { normalizePrivacySettings } from "@/lib/utils/privacy";

const getSettings = createServerFn({ method: "GET" }).handler(() => settingsPageData());

export const Route = createFileRoute("/_protected/settings")({
  head: () => privatePageHead(),
  loader: () => getSettings(),
  component: SettingsPage,
  pendingComponent: SettingsLoading,
  errorComponent: ProtectedError,
});

interface ProfileSectionProps {
  name: string;
  email: string;
  headline: string | null;
  image: string | null;
  handle: string | null;
}

function ProfileSection({ name, email, headline, image, handle }: ProfileSectionProps) {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6 h-full flex flex-col">
      <div className="flex items-start gap-4 mb-4">
        {image ? (
          <img
            src={image}
            alt="Profile avatar"
            className="w-14 h-14 rounded-full object-cover border border-border shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-brand-subtle flex items-center justify-center shrink-0 border border-border">
            <User className="h-6 w-6 text-brand" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-foreground truncate">{name}</h2>
          <p className="text-sm text-muted-foreground truncate">{email}</p>
          {headline && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{headline}</p>
          )}
        </div>
      </div>

      {handle && (
        <>
          <Separator className="my-4" />
          <HandleForm currentHandle={handle} />
        </>
      )}

      {!handle && (
        <>
          <Separator className="my-4" />
          <div className="rounded-lg bg-warning/10 border border-warning/30 p-3">
            <p className="text-sm text-warning">Complete your profile setup to get a public URL.</p>
          </div>
        </>
      )}
    </div>
  );
}

function SettingsPage() {
  const { session, profile, resumeCount: resumeData, latestResume } = Route.useLoaderData();

  const privacySettings = normalizePrivacySettings(profile.privacySettings);

  const resumeCount = resumeData[0]?.count ?? 0;

  const latestResumeDate = latestResume?.createdAt;
  const latestResumeStatus = latestResume?.status;
  const latestResumeError = latestResume?.errorMessage;
  const latestResumeId = latestResume?.id;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-5xl mx-auto px-4 lg:px-6 space-y-6">
        <div className="mb-2">
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and privacy settings</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProfileSection
            name={session.user.name || "User"}
            email={profile.email}
            headline={profile.headline}
            image={profile.image}
            handle={profile.handle}
          />

          <ResumeManagementCard
            resumeCount={resumeCount}
            latestResumeDate={latestResumeDate ?? undefined}
            latestResumeStatus={latestResumeStatus}
            latestResumeError={latestResumeError ?? undefined}
            latestResumeId={latestResumeId}
          />
        </div>

        <RoleSelectorCard
          currentRole={profile.role ?? null}
          roleSource={profile.roleSource ?? null}
          isFreelance={profile.isFreelance}
        />

        <PrivacySettingsForm
          initialSettings={privacySettings}
          initialUpdatedAt={profile.updatedAt}
        />

        <DeleteAccountCard userEmail={profile.email} />
      </div>
    </div>
  );
}

function SettingsLoading() {
  return (
    <div className="container mx-auto max-w-2xl p-6">
      <div className="mb-8">
        <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-10 w-full animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
