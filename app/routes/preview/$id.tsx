import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { edgeCacheHeaders } from "@/lib/cache/edge-cache";
import { previewPageData } from "@/lib/data/preview-page";
import { NOINDEX } from "@/lib/seo/page-metadata";
import { getTemplate, ThemeTemplate } from "@/lib/templates/theme-registry";
import { cn } from "@/lib/utils/cn";

const getPreview = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(({ data }) => previewPageData(data));

export const Route = createFileRoute("/preview/$id")({
  loader: async ({ params }) => {
    const page = await getPreview({ data: params.id });
    await getTemplate(page.id);

    return page;
  },
  head: () => ({ meta: [{ name: "robots", content: NOINDEX }] }),
  headers: () => edgeCacheHeaders(604800),
  component: PreviewPage,
});

function PreviewPage() {
  const { id, content, profile, chrome } = Route.useLoaderData();
  const bg = chrome.background;

  return (
    <main
      id="main-content"
      className={cn("min-h-screen", bg?.bg ?? "bg-white", bg?.isDark ? "dark" : "")}
    >
      <ThemeTemplate themeId={id} content={content} profile={profile} share={chrome.share} />
    </main>
  );
}
