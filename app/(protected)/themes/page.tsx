import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ThemeSelector } from "@/components/dashboard/ThemeSelector";
import { getServerSession } from "@/lib/auth/session";
import { siteConfig } from "@/lib/config/site";
import { getDb } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";
import { DEFAULT_THEME } from "@/lib/templates/theme-ids";
import type { ResumeContent } from "@/lib/types/database";

export const metadata: Metadata = {
  title: `Themes | ${siteConfig.fullName}`,
  description: "Choose your resume theme",
};

export default async function ThemesPage() {
  // Use cached session helper to deduplicate auth calls within request
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/");
  }

  // 2. Get database connection
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  // 3. Fetch user's site data (theme + content) and profile info (including referralCount) in parallel
  const [userSiteData, userProfile] = await Promise.all([
    db.query.siteData.findFirst({
      where: eq(siteData.userId, session.user.id),
      columns: { themeId: true, content: true },
    }),
    db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: { handle: true, image: true, isPro: true, referralCount: true },
    }),
  ]);

  // Use pre-computed referralCount from user table
  const referralCount = userProfile?.referralCount ?? 0;
  const isPro = userProfile?.isPro ?? false;

  // Redirect to dashboard if no resume has been uploaded/parsed yet
  if (!userSiteData?.content) {
    redirect("/dashboard");
  }

  const currentThemeId = userSiteData.themeId || DEFAULT_THEME;
  const parsedContent = JSON.parse(userSiteData.content) as ResumeContent;
  const profile = {
    handle: userProfile?.handle || session.user.name || "user",
    avatar_url: userProfile?.image || null,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Theme Selector with Live Preview */}
        <ThemeSelector
          initialThemeId={currentThemeId}
          initialContent={parsedContent}
          profile={profile}
          referralCount={referralCount}
          isPro={isPro}
        />
      </div>
    </div>
  );
}
