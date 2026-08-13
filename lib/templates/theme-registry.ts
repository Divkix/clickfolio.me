/**
 * Server-side theme registry.
 *
 * Provides async template loading for server components via dynamic import().
 * Falls back to the default theme when an invalid ID is requested.
 */

import type { TemplateProps } from "@/lib/types/template";
import { DEFAULT_THEME, isValidThemeId, type ThemeId } from "./theme-ids";

/**
 * Lazy loaders — each returns a dynamic import() promise.
 * Used by server components via the async getTemplate().
 */
const TEMPLATE_LOADERS = {
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
} satisfies Record<ThemeId, () => Promise<{ [key: string]: React.ComponentType<TemplateProps> }>>;

const TEMPLATE_EXPORT_NAME = {
  bento: "BentoGrid",
  bold_corporate: "BoldCorporate",
  classic_ats: "ClassicATS",
  design_folio: "DesignFolio",
  dev_terminal: "DevTerminal",
  glass: "GlassMorphic",
  midnight: "Midnight",
  minimalist_editorial: "MinimalistEditorial",
  neo_brutalist: "NeoBrutalist",
  spotlight: "Spotlight",
} satisfies Record<ThemeId, string>;

/**
 * Get template component by theme ID (async — for server components).
 * Falls back to default theme if ID is invalid.
 */
export async function getTemplate(
  themeId: string | null | undefined,
): Promise<React.ComponentType<TemplateProps>> {
  const resolvedId: ThemeId = themeId && isValidThemeId(themeId) ? themeId : DEFAULT_THEME;
  const mod = await TEMPLATE_LOADERS[resolvedId]();
  const exportName = TEMPLATE_EXPORT_NAME[resolvedId];
  // SAFETY: mod is dynamic import namespace for validated ThemeId; casting to Record bridges typed template registry — exportName is guaranteed to exist for resolvedId.
  return (mod as Record<string, React.ComponentType<TemplateProps>>)[exportName];
}
