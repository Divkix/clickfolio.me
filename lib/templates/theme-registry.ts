/**
 * Server-side theme registry.
 *
 * Provides async template loading for server components via dynamic import().
 * Falls back to the default theme when an invalid ID is requested.
 */

import type { TemplateProps } from "@/lib/types/template";
import { DEFAULT_THEME, isValidThemeId, type ThemeId } from "./theme-ids";

/**
 * Lazy loaders — each resolves directly to the template component.
 * Used by server components via the async getTemplate().
 */
type TemplateLoader = () => Promise<React.FC<TemplateProps>>;
const TEMPLATE_LOADERS = {
  bento: () => import("@/components/templates/BentoGrid").then((m) => m.BentoGrid),
  bold_corporate: () => import("@/components/templates/BoldCorporate").then((m) => m.BoldCorporate),
  classic_ats: () => import("@/components/templates/ClassicATS").then((m) => m.ClassicATS),
  design_folio: () => import("@/components/templates/DesignFolio").then((m) => m.DesignFolio),
  dev_terminal: () => import("@/components/templates/DevTerminal").then((m) => m.DevTerminal),
  glass: () => import("@/components/templates/GlassMorphic").then((m) => m.GlassMorphic),
  midnight: () => import("@/components/templates/Midnight").then((m) => m.Midnight),
  minimalist_editorial: () =>
    import("@/components/templates/MinimalistEditorial").then((m) => m.MinimalistEditorial),
  neo_brutalist: () => import("@/components/templates/NeoBrutalist").then((m) => m.NeoBrutalist),
  spotlight: () => import("@/components/templates/Spotlight").then((m) => m.Spotlight),
} satisfies Record<ThemeId, TemplateLoader>;

/**
 * Get template component by theme ID (async — for server components).
 * Falls back to default theme if ID is invalid.
 */
export async function getTemplate(
  themeId: string | null | undefined,
): Promise<React.FC<TemplateProps>> {
  const resolvedId: ThemeId = themeId && isValidThemeId(themeId) ? themeId : DEFAULT_THEME;
  const loader = TEMPLATE_LOADERS[resolvedId] ?? TEMPLATE_LOADERS[DEFAULT_THEME];
  return loader();
}
