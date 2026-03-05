"use client";

import dynamic from "next/dynamic";
import type { TemplateProps } from "@/lib/types/template";
import type { ThemeId } from "./theme-ids";

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
  classic_ats: dynamic(() => import("@/components/templates/ClassicATS"), {
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
