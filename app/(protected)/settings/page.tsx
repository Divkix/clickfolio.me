import { getCloudflareContext } from "@opennextjs/cloudflare";
import { count, desc, eq, sql } from "drizzle-orm";
import { User } from "lucide-react";
import { redirect } from "next/navigation";
import { HandleForm } from "@/components/forms/HandleForm";
import { PrivacySettingsForm } from "@/components/forms/PrivacySettings";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";
import { ResumeManagementCard } from "@/components/settings/ResumeManagementCard";
import { Separator } from "@/components/ui/separator";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { resumes, user } from "@/lib/db/schema";
import { isValidPrivacySettings, normalizePrivacySettings } from "@/lib/utils/privacy";

interface ProfileSectionProps {
  name: string;
  email: string;
  headline: string | null;
  image: string | null;
  handle: string | null;
}

function ProfileSection({ name, email, headline, image, handle }: ProfileSectionProps) {
  return (
    <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6 h-full flex flex-col">
      {/* Profile header with avatar */}
      <div className="flex items-start gap-4 mb-4">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt="Profile avatar"
            className="w-14 h-14 rounded-full object-cover border-2 border-slate-200/60 shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center shrink-0 border-2 border-slate-200/60">
            <User className="h-6 w-6 text-indigo-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-slate-900 truncate">{name}</h2>
          <p className="text-sm text-slate-600 truncate">{email}</p>
          {headline && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{headline}</p>}
        </div>
      </div>

      {handle && (
        <>
          <Separator className="my-4" />
          <HandleForm currentHandle={handle} variant="compact" />
        </>
      )}

      {!handle && (
        <>
          <Separator className="my-4" />
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-800">
              Complete your profile setup to get a public URL.
            </p>
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

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  const [profile, resumeData] = await Promise.all([
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

  const privacySettings = normalizePrivacySettings(
    isValidPrivacySettings(parsedPrivacySettings) ? parsedPrivacySettings : null,
  );

  const resumeCount = resumeData[0]?.count ?? 0;

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
        {/* Page Header */}
        <div className="mb-2">
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600 mt-1">Manage your account and privacy settings</p>
        </div>

        {/* Top Row: 2-column grid for Profile and Resume */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Profile + Handle combined */}
          <ProfileSection
            name={session.user.name || "User"}
            email={profile.email}
            headline={profile.headline}
            image={profile.image}
            handle={profile.handle}
          />

          {/* Right: Resume compact */}
          <ResumeManagementCard
            resumeCount={resumeCount}
            latestResumeDate={(latestResume?.createdAt as string | undefined) ?? undefined}
            latestResumeStatus={latestResume?.status as string | undefined | null}
            latestResumeError={
              (latestResume?.errorMessage as string | undefined | null) ?? undefined
            }
            latestResumeId={latestResume?.id as string}
          />
        </div>

        {/* Full width: Privacy horizontal */}
        <PrivacySettingsForm initialSettings={privacySettings} userHandle={profile.handle} />

        {/* Full width: Danger zone inline */}
        <DeleteAccountCard userEmail={profile.email} />
      </div>
    </div>
  );
}
