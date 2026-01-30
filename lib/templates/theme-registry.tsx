import dynamic from "next/dynamic";
import type { TemplateProps } from "@/lib/types/template";
import { DEFAULT_THEME, isValidThemeId, type ThemeId } from "./theme-ids";

export type { ThemeId } from "./theme-ids";
// Re-export everything from theme-ids for backward compatibility
export {
  DEFAULT_THEME,
  getThemeReferralRequirement,
  getUnlockedThemes,
  isThemeUnlocked,
  isValidThemeId,
  THEME_IDS,
  THEME_METADATA,
} from "./theme-ids";

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

/**
 * Loading placeholder shown while a dynamic template chunk loads.
 */
function TemplateLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading template...</div>
    </div>
  );
}

/**
 * next/dynamic wrappers — for client components that cannot await.
 * Each key lazily loads the template component with a shared loading fallback.
 */
export const DYNAMIC_TEMPLATES: Record<ThemeId, React.ComponentType<TemplateProps>> = {
  bento: dynamic(() => import("@/components/templates/BentoGrid"), {
    loading: TemplateLoadingFallback,
  }),
  bold_corporate: dynamic(() => import("@/components/templates/BoldCorporate"), {
    loading: TemplateLoadingFallback,
  }),
  design_folio: dynamic(() => import("@/components/templates/DesignFolio"), {
    loading: TemplateLoadingFallback,
  }),
  dev_terminal: dynamic(() => import("@/components/templates/DevTerminal"), {
    loading: TemplateLoadingFallback,
  }),
  glass: dynamic(() => import("@/components/templates/GlassMorphic"), {
    loading: TemplateLoadingFallback,
  }),
  midnight: dynamic(() => import("@/components/templates/Midnight"), {
    loading: TemplateLoadingFallback,
  }),
  minimalist_editorial: dynamic(() => import("@/components/templates/MinimalistEditorial"), {
    loading: TemplateLoadingFallback,
  }),
  neo_brutalist: dynamic(() => import("@/components/templates/NeoBrutalist"), {
    loading: TemplateLoadingFallback,
  }),
  spotlight: dynamic(() => import("@/components/templates/Spotlight"), {
    loading: TemplateLoadingFallback,
  }),
};
