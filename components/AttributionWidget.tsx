"use client";

import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

type ThemeId =
  | "minimalist_editorial"
  | "glassmorphic"
  | "neo_brutalist"
  | "bento_grid"
  | "spotlight"
  | "midnight"
  | "bold_corporate"
  | "dev_terminal"
  | "design_folio"
  | "classic_ats";

interface AttributionWidgetProps {
  theme: string;
}

/**
 * Persistent attribution widget for public resume pages
 * Theme-adaptive styling with shimmer animation on hover
 */
export function AttributionWidget({ theme }: AttributionWidgetProps) {
  // Theme-specific styles using data attributes for clean conditional rendering
  const themeStyles: Record<
    ThemeId,
    {
      container: string;
      accent: string;
      shimmer: string;
      shadow: string;
    }
  > = {
    minimalist_editorial: {
      container:
        "bg-amber-50/95 sm:bg-amber-50/80 border border-stone-300/50 text-stone-800 hover:text-stone-900",
      accent: "text-amber-700",
      shimmer: "from-transparent via-amber-200/30 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    glassmorphic: {
      container:
        "bg-slate-900/80 sm:bg-slate-900/80 backdrop-blur-md border border-white/20 text-white/90 hover:text-white",
      accent: "text-cyan-400",
      shimmer: "from-transparent via-white/20 to-transparent",
      shadow: "shadow-depth-lg hover:shadow-depth-xl",
    },
    neo_brutalist: {
      container: "bg-yellow-300 border-4 border-black text-black font-bold",
      accent: "text-pink-500",
      shimmer: "from-transparent via-white/40 to-transparent",
      shadow: "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
    },
    bento_grid: {
      container:
        "bg-white/95 sm:bg-white border border-slate-200/60 text-slate-600 hover:text-slate-900",
      accent: "bg-linear-to-r from-coral to-coral bg-clip-text text-transparent",
      shimmer: "from-transparent via-coral/30 to-transparent",
      shadow: "shadow-depth-sm hover:shadow-depth-md",
    },
    spotlight: {
      container:
        "bg-stone-50/95 sm:bg-stone-50/80 border border-stone-300/50 text-stone-700 hover:text-stone-900",
      accent: "text-orange-600",
      shimmer: "from-transparent via-orange-200/30 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    midnight: {
      container:
        "bg-neutral-900/90 sm:bg-neutral-900/80 backdrop-blur-md border border-amber-400/20 text-amber-100/80 hover:text-amber-100",
      accent: "text-amber-400",
      shimmer: "from-transparent via-amber-400/20 to-transparent",
      shadow: "shadow-lg hover:shadow-xl",
    },
    bold_corporate: {
      container:
        "bg-white/95 sm:bg-white border border-neutral-200 text-neutral-500 hover:text-neutral-800",
      accent: "text-neutral-900",
      shimmer: "from-transparent via-neutral-200/30 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    dev_terminal: {
      container:
        "bg-[#161b22]/95 backdrop-blur-md border border-[#30363d] text-[#c9d1d9] hover:text-white",
      accent: "text-[#58a6ff]",
      shimmer: "from-transparent via-[#58a6ff]/20 to-transparent",
      shadow: "shadow-lg hover:shadow-xl",
    },
    design_folio: {
      container:
        "bg-[#1a1a1a]/95 backdrop-blur-md border border-[#333] text-[#888] hover:text-[#e0e0e0]",
      accent: "text-[#CCFF00]",
      shimmer: "from-transparent via-[#CCFF00]/20 to-transparent",
      shadow: "shadow-lg hover:shadow-xl",
    },
    classic_ats: {
      container: "bg-white/95 border border-gray-300 text-gray-600 hover:text-gray-900",
      accent: "text-gray-800",
      shimmer: "from-transparent via-gray-200/30 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
  };

  // Type guard to check if theme is a valid ThemeId
  const isValidTheme = (t: string): t is ThemeId => {
    return t in themeStyles;
  };

  // Use theme if valid, otherwise default to bento_grid
  const currentTheme = isValidTheme(theme) ? themeStyles[theme] : themeStyles.bento_grid;

  return (
    <Link
      href="/"
      className={`
        group fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-30
        px-3 py-2 sm:px-4 sm:py-3 rounded-lg
        flex items-center gap-2
        hover:-translate-y-0.5
        transition-all duration-300
        overflow-hidden
        ${currentTheme.container}
        ${currentTheme.shadow}
      `}
      aria-label={`Visit ${siteConfig.fullName} homepage`}
    >
      {/* Shimmer effect overlay - only visible on hover */}
      <div
        className={`
          absolute inset-0 bg-linear-to-r
          -translate-x-full group-hover:translate-x-full
          transition-transform duration-700 ease-out
          ${currentTheme.shimmer}
        `}
      />

      {/* Content */}
      <div className="relative z-10 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-medium">
        <span>Built with</span>
        <span className="font-semibold">
          {siteConfig.name}
          <span className={currentTheme.accent}>{siteConfig.tld}</span>
        </span>
      </div>
    </Link>
  );
}
