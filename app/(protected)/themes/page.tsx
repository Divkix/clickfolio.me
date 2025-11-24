import { redirect } from "next/navigation";
import { ThemeSelector } from "@/components/dashboard/ThemeSelector";
import { siteConfig } from "@/lib/config/site";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: `Themes | ${siteConfig.fullName}`,
  description: "Choose your resume theme",
};

export default async function ThemesPage() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch user's current theme
  const { data: siteData } = await supabase
    .from("site_data")
    .select("theme_id")
    .eq("user_id", user.id)
    .single();

  const currentThemeId = siteData?.theme_id || "minimalist_editorial";

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
            Choose Your Theme
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Customize how your resume appears to visitors. Each theme offers a unique visual style.
          </p>
        </div>

        {/* Theme Selector */}
        <ThemeSelector initialThemeId={currentThemeId} />
      </div>
    </div>
  );
}
