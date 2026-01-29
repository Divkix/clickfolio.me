import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ThemeSelector } from "@/components/dashboard/ThemeSelector";
import { getServerSession } from "@/lib/auth/session";
import { siteConfig } from "@/lib/config/site";
import { getDb } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";
import type { ResumeContent } from "@/lib/types/database";

export const metadata = {
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

  // 3. Fetch user's site data (theme + content), profile info, and referral count in parallel
  const [userSiteData, userProfile, referralCountResult] = await Promise.all([
    db.query.siteData.findFirst({
      where: eq(siteData.userId, session.user.id),
      columns: { themeId: true, content: true },
    }),
    db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: { handle: true, image: true },
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .where(eq(user.referredBy, session.user.id)),
  ]);

  const referralCount = referralCountResult[0]?.count ?? 0;

  // Redirect to dashboard if no resume has been uploaded/parsed yet
  if (!userSiteData?.content) {
    redirect("/dashboard");
  }

  const currentThemeId = userSiteData.themeId || "minimalist_editorial";
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
        />
      </div>
    </div>
  );
}
