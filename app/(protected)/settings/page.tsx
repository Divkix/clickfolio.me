import { env } from "cloudflare:workers";
import { count, desc, eq } from "drizzle-orm";
import { User } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HandleForm } from "@/components/forms/HandleForm";
import { PrivacySettingsForm } from "@/components/forms/PrivacySettings";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";
import { ResumeManagementCard } from "@/components/settings/ResumeManagementCard";
import { RoleSelectorCard } from "@/components/settings/RoleSelectorCard";
import { Separator } from "@/components/ui/separator";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { resumes, user } from "@/lib/db/schema";
import { normalizePrivacySettings } from "@/lib/utils/privacy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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

export default async function SettingsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/");
  }

  const db = getDb(env.HYPERDRIVE);

  const [profile, resumeData, latestResume] = await Promise.all([
    db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: {
        id: true,
        email: true,
        handle: true,
        headline: true,
        image: true,
        privacySettings: true,
        role: true,
        roleSource: true,
      },
    }),
    db
      .select({
        count: count(),
      })
      .from(resumes)
      .where(eq(resumes.userId, session.user.id)),
    db.query.resumes.findFirst({
      where: eq(resumes.userId, session.user.id),
      orderBy: [desc(resumes.createdAt)],
      columns: {
        id: true,
        createdAt: true,
        status: true,
        errorMessage: true,
      },
    }),
  ]);

  if (!profile) {
    console.error("Failed to fetch profile for user:", session.user.id);
    redirect("/dashboard");
  }

  const privacySettings = normalizePrivacySettings(profile.privacySettings);

  const resumeCount = resumeData[0]?.count ?? 0;

  // SAFETY: latestResume.createdAt is string from Drizzle schema; cast handles nullable date for card prop.
  const latestResumeDate = latestResume?.createdAt as string | undefined;
  // SAFETY: latestResume.status is string from Drizzle resume status enum; cast for card prop.
  const latestResumeStatus = latestResume?.status as string | undefined | null;
  // SAFETY: latestResume.errorMessage is string | null from Drizzle; cast for error display fallback.
  const latestResumeError = latestResume?.errorMessage as string | undefined | null;
  // SAFETY: latestResume.id is string from Drizzle schema; cast handles optional id for card.
  const latestResumeId = latestResume?.id as string;

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
        />

        <PrivacySettingsForm initialSettings={privacySettings} />

        <DeleteAccountCard userEmail={profile.email} />
      </div>
    </div>
  );
}
