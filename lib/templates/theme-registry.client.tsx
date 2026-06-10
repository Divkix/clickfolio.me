/**
 * Client-side theme registry.
 *
 * Provides `next/dynamic` wrappers for all resume templates so they can be
 * lazily loaded in client components with a shared loading fallback.
 */

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
  bento: dynamic(
    () => import("@/components/templates/BentoGrid").then((m) => ({ default: m.BentoGrid })),
    {
      loading: TemplateLoadingFallback,
    },
  ),
  bold_corporate: dynamic(
    () =>
      import("@/components/templates/BoldCorporate").then((m) => ({ default: m.BoldCorporate })),
    {
      loading: TemplateLoadingFallback,
    },
  ),
  classic_ats: dynamic(
    () => import("@/components/templates/ClassicATS").then((m) => ({ default: m.ClassicATS })),
    {
      loading: TemplateLoadingFallback,
    },
  ),
  design_folio: dynamic(
    () => import("@/components/templates/DesignFolio").then((m) => ({ default: m.DesignFolio })),
    {
      loading: TemplateLoadingFallback,
    },
  ),
  dev_terminal: dynamic(
    () => import("@/components/templates/DevTerminal").then((m) => ({ default: m.DevTerminal })),
    {
      loading: TemplateLoadingFallback,
    },
  ),
  glass: dynamic(
    () => import("@/components/templates/GlassMorphic").then((m) => ({ default: m.GlassMorphic })),
    {
      loading: TemplateLoadingFallback,
    },
  ),
  midnight: dynamic(
    () => import("@/components/templates/Midnight").then((m) => ({ default: m.Midnight })),
    {
      loading: TemplateLoadingFallback,
    },
  ),
  minimalist_editorial: dynamic(
    () =>
      import("@/components/templates/MinimalistEditorial").then((m) => ({
        default: m.MinimalistEditorial,
      })),
    {
      loading: TemplateLoadingFallback,
    },
  ),
  neo_brutalist: dynamic(
    () => import("@/components/templates/NeoBrutalist").then((m) => ({ default: m.NeoBrutalist })),
    {
      loading: TemplateLoadingFallback,
    },
  ),
  spotlight: dynamic(
    () => import("@/components/templates/Spotlight").then((m) => ({ default: m.Spotlight })),
    {
      loading: TemplateLoadingFallback,
    },
  ),
};
