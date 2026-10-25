import { Suspense, use } from "react";
import type { TemplateProps } from "@/lib/types/template";
import { resolveThemeId, type ThemeId } from "./theme-ids";

type Template = React.FC<TemplateProps>;

type TemplateLoader = () => Promise<Template>;

export const TEMPLATE_LOADERS = {
  bento: () => import("@/components/templates/BentoGrid").then((m) => m.BentoGrid),
  boardroom: () => import("@/components/templates/Boardroom").then((m) => m.Boardroom),
  bold_corporate: () => import("@/components/templates/BoldCorporate").then((m) => m.BoldCorporate),
  broadsheet: () => import("@/components/templates/Broadsheet").then((m) => m.Broadsheet),
  case_file: () => import("@/components/templates/CaseFile").then((m) => m.CaseFile),
  classic_ats: () => import("@/components/templates/ClassicATS").then((m) => m.ClassicATS),
  design_folio: () => import("@/components/templates/DesignFolio").then((m) => m.DesignFolio),
  dev_terminal: () => import("@/components/templates/DevTerminal").then((m) => m.DevTerminal),
  glass: () => import("@/components/templates/GlassMorphic").then((m) => m.GlassMorphic),
  midnight: () => import("@/components/templates/Midnight").then((m) => m.Midnight),
  minimalist_editorial: () =>
    import("@/components/templates/MinimalistEditorial").then((m) => m.MinimalistEditorial),
  neo_brutalist: () => import("@/components/templates/NeoBrutalist").then((m) => m.NeoBrutalist),
  retro_os: () => import("@/components/templates/RetroOS").then((m) => m.RetroOS),
  spotlight: () => import("@/components/templates/Spotlight").then((m) => m.Spotlight),
  academic_cv: () => import("@/components/templates/AcademicCV").then((m) => m.AcademicCV),
  contact_sheet: () => import("@/components/templates/ContactSheet").then((m) => m.ContactSheet),
  workspace: () => import("@/components/templates/Workspace").then((m) => m.Workspace),
  blueprint: () => import("@/components/templates/Blueprint").then((m) => m.Blueprint),
  scrapbook: () => import("@/components/templates/Scrapbook").then((m) => m.Scrapbook),
  media_kit: () => import("@/components/templates/MediaKit").then((m) => m.MediaKit),
  liner_notes: () => import("@/components/templates/LinerNotes").then((m) => m.LinerNotes),
  rounds: () => import("@/components/templates/Rounds").then((m) => m.Rounds),
  lesson_plan: () => import("@/components/templates/LessonPlan").then((m) => m.LessonPlan),
  manuscript: () => import("@/components/templates/Manuscript").then((m) => m.Manuscript),
  gallery_wall: () => import("@/components/templates/GalleryWall").then((m) => m.GalleryWall),
  quota: () => import("@/components/templates/Quota").then((m) => m.Quota),
  the_brief: () => import("@/components/templates/TheBrief").then((m) => m.TheBrief),
  open_house: () => import("@/components/templates/OpenHouse").then((m) => m.OpenHouse),
  the_menu: () => import("@/components/templates/TheMenu").then((m) => m.TheMenu),
  personal_best: () => import("@/components/templates/PersonalBest").then((m) => m.PersonalBest),
  pitch_deck: () => import("@/components/templates/PitchDeck").then((m) => m.PitchDeck),
  reel: () => import("@/components/templates/Reel").then((m) => m.Reel),
  link_stack: () => import("@/components/templates/LinkStack").then((m) => m.LinkStack),
} satisfies Record<ThemeId, TemplateLoader>;

/** A load that `use()` reads synchronously once these fields say it has settled. */
type TemplateLoad = Promise<Template> & {
  status?: "fulfilled" | "rejected";
  value?: Template;
  reason?: unknown;
};

const loads = new Map<ThemeId, TemplateLoad>();

/**
 * Loads a theme's template once per isolate or tab. Route loaders await it, so server renders and
 * client navigations draw `ThemeTemplate` in place; only hydration waits for the chunk, and React
 * keeps the server HTML meanwhile. A failed load is forgotten so the next render retries it.
 */
export function getTemplate(themeId: string | null | undefined): Promise<Template> {
  const id = resolveThemeId(themeId);
  const cached = loads.get(id);

  if (cached) return cached;

  const load: TemplateLoad = TEMPLATE_LOADERS[id]();
  load.then(
    (value) => {
      load.status = "fulfilled";
      load.value = value;
    },
    (reason) => {
      load.status = "rejected";
      load.reason = reason;
      loads.delete(id);
    },
  );
  loads.set(id, load);

  return load;
}

type ThemeTemplateProps = TemplateProps & { themeId: ThemeId };

function LoadedTemplate({ themeId, ...props }: ThemeTemplateProps) {
  const Template = use(getTemplate(themeId));

  // eslint-disable-next-line react/static-components -- `getTemplate` caches one component per theme, so its identity is stable across renders
  return <Template {...props} />;
}

function TemplateLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading template...</div>
    </div>
  );
}

/** A theme's template: in place once `getTemplate(themeId)` has resolved, a fallback until then. */
export function ThemeTemplate(props: ThemeTemplateProps) {
  return (
    <Suspense fallback={<TemplateLoadingFallback />}>
      <LoadedTemplate {...props} />
    </Suspense>
  );
}
