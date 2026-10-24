"use client";

import dynamic from "next/dynamic";
import type { TemplateProps } from "@/lib/types/template";
import type { ThemeId } from "./theme-ids";
import { TEMPLATE_LOADERS } from "./theme-registry";

function TemplateLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading template...</div>
    </div>
  );
}

// ponytail: shared loaders forgo vinext's inline-import SSR preloads in dashboard previews;
// restore literal dynamic imports if preview hydration latency warrants the duplicated registry.
// SAFETY: Each entry preserves its ThemeId key and wraps its typed template loader.
export const DYNAMIC_TEMPLATES = Object.fromEntries(
  Object.entries(TEMPLATE_LOADERS).map(([themeId, loader]) => [
    themeId,
    dynamic<TemplateProps>(loader, { loading: TemplateLoadingFallback }),
  ]),
) as Record<ThemeId, React.ComponentType<TemplateProps>>;
