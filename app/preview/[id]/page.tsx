import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEMO_RESUME_CONTENT, TEMPLATE_BACKGROUNDS } from "@/lib/templates/demo-data";
import type { ThemeId } from "@/lib/templates/theme-ids";
import { getTemplate } from "@/lib/templates/theme-registry";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const revalidate = 604800;

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // SAFETY: id is validated ThemeId via isValidThemeId or known demo-data keys; cast bridges string to ThemeId.
  const themeId = id as ThemeId;
  const content = DEMO_RESUME_CONTENT[themeId];

  if (!content) {
    notFound();
  }

  const Template = await getTemplate(themeId);
  const bg = TEMPLATE_BACKGROUNDS[themeId];
  const profile = {
    avatar_url: null,
    handle: content.full_name.toLowerCase().replace(/\s+/g, ""),
  };

  return (
    <div className={cn("min-h-screen", bg?.bg ?? "bg-white", bg?.isDark ? "dark" : "")}>
      <Template content={content} profile={profile} />
    </div>
  );
}
