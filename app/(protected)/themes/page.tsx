import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ThemeSelector } from "@/components/dashboard/ThemeSelector";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";
import { DEFAULT_THEME, isValidThemeId, type ThemeId } from "@/lib/templates/theme-ids";
import type { ResumeContent } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Themes",
  description: "Choose your resume theme",
};

export default async function ThemesPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/");
  }

  const db = getDb(env.HYPERDRIVE);

  const [userSiteData, userProfile] = await Promise.all([
    db.query.siteData.findFirst({
      where: eq(siteData.userId, session.user.id),
      columns: { themeId: true, content: true },
    }),
    db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: { handle: true, image: true },
    }),
  ]);

  if (!userSiteData?.content) {
    redirect("/dashboard");
  }

  const rawThemeId = userSiteData.themeId;
  const currentThemeId: ThemeId =
    rawThemeId && isValidThemeId(rawThemeId) ? rawThemeId : DEFAULT_THEME;
  // SAFETY: content is schema-validated JSONB written by the queue consumer and /api/resume/update; cast bridges the column's wide Record type.
  const parsedContent = userSiteData.content as ResumeContent;
  const profile = {
    handle: userProfile?.handle || session.user.name || "user",
    avatar_url: userProfile?.image || null,
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <ThemeSelector
          initialThemeId={currentThemeId}
          initialContent={parsedContent}
          profile={profile}
        />
      </div>
    </div>
  );
}
