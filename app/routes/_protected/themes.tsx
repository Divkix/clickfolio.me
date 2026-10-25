import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ProtectedError } from "@/components/errors/ProtectedError";
import { ThemeSelector } from "@/components/dashboard/ThemeSelector";
import { themesPageData } from "@/lib/data/owner-pages";
import { privatePageHead } from "@/lib/seo/page-metadata";
import { resolveThemeId } from "@/lib/templates/theme-ids";

const getThemes = createServerFn({ method: "GET" }).handler(() => themesPageData());

export const Route = createFileRoute("/_protected/themes")({
  head: () => privatePageHead("Themes"),
  loader: () => getThemes(),
  component: ThemesPage,
  pendingComponent: ThemesLoading,
  errorComponent: ProtectedError,
});

function ThemesPage() {
  const { session, choice } = Route.useLoaderData();

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

function ThemesLoading() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>
    </div>
  );
}
