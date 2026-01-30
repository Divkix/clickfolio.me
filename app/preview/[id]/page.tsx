import { notFound } from "next/navigation";
import { DEMO_RESUME_CONTENT, TEMPLATE_BACKGROUNDS } from "@/lib/templates/demo-data";
import type { ThemeId } from "@/lib/templates/theme-ids";
import { getTemplate } from "@/lib/templates/theme-registry";

/**
 * Standalone template preview page used by the thumbnail generator script.
 * Not linked from the UI — only accessed via scripts/generate-thumbnails.ts.
 */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    <div className={bg?.bg ?? "bg-white"}>
      <Template content={content} profile={profile} />
    </div>
  );
}
