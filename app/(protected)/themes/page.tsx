import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ThemeSelector } from "@/components/dashboard/ThemeSelector";
import { getServerSession } from "@/lib/auth/session";
import { loadThemeChoice } from "@/lib/data/owner-pages";
import { Db } from "@/lib/effect/db";
import { runPage } from "@/lib/effect/edges";
import { resolveThemeId } from "@/lib/templates/theme-ids";

export const metadata: Metadata = {
  title: "Themes",
  description: "Choose your resume theme",
};

export default async function ThemesPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/");
  }

  const choice = await runPage(loadThemeChoice(session.user.id), Db.layer(env.HYPERDRIVE));

  if (!choice) {
    redirect("/dashboard");
  }

  const currentThemeId = resolveThemeId(choice.themeId);

  const profile = {
    handle: session.user.handle || session.user.name || "user",
    avatar_url: session.user.image || null,
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <ThemeSelector
          initialThemeId={currentThemeId}
          initialContent={choice.content}
          profile={profile}
        />
      </div>
    </div>
  );
}
