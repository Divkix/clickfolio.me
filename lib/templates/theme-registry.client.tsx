"use client";

import dynamic from "next/dynamic";
import type { TemplateProps } from "@/lib/types/template";
import type { ThemeId } from "./theme-ids";

function TemplateLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading template...</div>
    </div>
  );
}

export const DYNAMIC_TEMPLATES = {
  bento: dynamic(
    () => import("@/components/templates/BentoGrid").then((m) => ({ default: m.BentoGrid })),
    {
      loading: TemplateLoadingFallback,
    },
  ),
  boardroom: dynamic(
    () => import("@/components/templates/Boardroom").then((m) => ({ default: m.Boardroom })),
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
  broadsheet: dynamic(
    () => import("@/components/templates/Broadsheet").then((m) => ({ default: m.Broadsheet })),
    {
      loading: TemplateLoadingFallback,
    },
  ),
  case_file: dynamic(
    () => import("@/components/templates/CaseFile").then((m) => ({ default: m.CaseFile })),
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
  retro_os: dynamic(
    () => import("@/components/templates/RetroOS").then((m) => ({ default: m.RetroOS })),
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
  academic_cv: dynamic(
    () => import("@/components/templates/AcademicCV").then((m) => ({ default: m.AcademicCV })),
    {
      loading: TemplateLoadingFallback,
    },
  ),
  contact_sheet: dynamic(
    () => import("@/components/templates/ContactSheet").then((m) => ({ default: m.ContactSheet })),
    {
      loading: TemplateLoadingFallback,
    },
  ),
  workspace: dynamic(
    () => import("@/components/templates/Workspace").then((m) => ({ default: m.Workspace })),
    {
      loading: TemplateLoadingFallback,
    },
  ),
} as const satisfies Record<ThemeId, React.ComponentType<TemplateProps>>;
