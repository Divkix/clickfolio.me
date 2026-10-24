import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEMO_RESUME_CONTENT } from "@/lib/templates/demo-data";
import { THEME_CHROME } from "@/lib/templates/theme-chrome";
import { isValidThemeId } from "@/lib/templates/theme-ids";
import { getTemplate } from "@/lib/templates/theme-registry";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const revalidate = 604800;

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isValidThemeId(id)) {
    notFound();
  }

  const content = DEMO_RESUME_CONTENT[id];

  const Template = await getTemplate(id);
  const bg = THEME_CHROME[id].background;

  const profile = {
    avatar_url: null,
    handle: content.full_name.toLowerCase().replace(/\s+/g, ""),
  };

  return (
    <main
      id="main-content"
      className={cn("min-h-screen", bg?.bg ?? "bg-white", bg?.isDark ? "dark" : "")}
    >
      <Template content={content} profile={profile} />
    </main>
  );
}
