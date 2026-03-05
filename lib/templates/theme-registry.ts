import type { TemplateProps } from "@/lib/types/template";
import { DEFAULT_THEME, isValidThemeId, type ThemeId } from "./theme-ids";

export type { ThemeId } from "./theme-ids";
export { isThemeUnlocked, THEME_IDS, THEME_METADATA } from "./theme-ids";

/**
 * Lazy loaders — each returns a dynamic import() promise.
 * Used by server components via the async getTemplate().
 */
const TEMPLATE_LOADERS: Record<
  ThemeId,
  () => Promise<{ default: React.ComponentType<TemplateProps> }>
> = {
  bento: () => import("@/components/templates/BentoGrid"),
  bold_corporate: () => import("@/components/templates/BoldCorporate"),
  classic_ats: () => import("@/components/templates/ClassicATS"),
  design_folio: () => import("@/components/templates/DesignFolio"),
  dev_terminal: () => import("@/components/templates/DevTerminal"),
  glass: () => import("@/components/templates/GlassMorphic"),
  midnight: () => import("@/components/templates/Midnight"),
  minimalist_editorial: () => import("@/components/templates/MinimalistEditorial"),
  neo_brutalist: () => import("@/components/templates/NeoBrutalist"),
  spotlight: () => import("@/components/templates/Spotlight"),
};

/**
 * Get template component by theme ID (async — for server components).
 * Falls back to default theme if ID is invalid.
 */
export async function getTemplate(
  themeId: string | null | undefined,
): Promise<React.ComponentType<TemplateProps>> {
  const resolvedId: ThemeId = themeId && isValidThemeId(themeId) ? themeId : DEFAULT_THEME;
  const mod = await TEMPLATE_LOADERS[resolvedId]();
  return mod.default;
}
