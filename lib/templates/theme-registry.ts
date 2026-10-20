import type { TemplateProps } from "@/lib/types/template";
import { DEFAULT_THEME, isValidThemeId, type ThemeId } from "./theme-ids";

type TemplateLoader = () => Promise<React.FC<TemplateProps>>;

const TEMPLATE_LOADERS = {
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
  sidebar_photo: () => import("@/components/templates/SidebarPhoto").then((m) => m.SidebarPhoto),
  infographic: () => import("@/components/templates/Infographic").then((m) => m.Infographic),
  timeline: () => import("@/components/templates/Timeline").then((m) => m.Timeline),
  networked: () => import("@/components/templates/Networked").then((m) => m.Networked),
  consulting_brief: () =>
    import("@/components/templates/ConsultingBrief").then((m) => m.ConsultingBrief),
  quota: () => import("@/components/templates/Quota").then((m) => m.Quota),
  the_brief: () => import("@/components/templates/TheBrief").then((m) => m.TheBrief),
  open_house: () => import("@/components/templates/OpenHouse").then((m) => m.OpenHouse),
  the_menu: () => import("@/components/templates/TheMenu").then((m) => m.TheMenu),
  personal_best: () => import("@/components/templates/PersonalBest").then((m) => m.PersonalBest),
  pitch_deck: () => import("@/components/templates/PitchDeck").then((m) => m.PitchDeck),
  dashboard: () => import("@/components/templates/Dashboard").then((m) => m.Dashboard),
  reel: () => import("@/components/templates/Reel").then((m) => m.Reel),
  link_stack: () => import("@/components/templates/LinkStack").then((m) => m.LinkStack),
  noir: () => import("@/components/templates/Noir").then((m) => m.Noir),
} satisfies Record<ThemeId, TemplateLoader>;

export async function getTemplate(
  themeId: string | null | undefined,
): Promise<React.FC<TemplateProps>> {
  const resolvedId: ThemeId = themeId && isValidThemeId(themeId) ? themeId : DEFAULT_THEME;
  const loader = TEMPLATE_LOADERS[resolvedId] ?? TEMPLATE_LOADERS[DEFAULT_THEME];

  return loader();
}
