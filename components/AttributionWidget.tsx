"use client";

import Link from "next/link";
import { siteConfig } from "@/lib/config/site";
import type { ThemeId } from "@/lib/templates/theme-ids";

interface AttributionWidgetProps {
  theme: string;
}

export function AttributionWidget({ theme }: AttributionWidgetProps) {
  const themeStyles = {
    minimalist_editorial: {
      container: "bg-white/95 border border-[#E4E4E7] text-[#6B6B73] hover:text-[#1B1B1F]",
      accent: "text-[#1F5C4A]",
      shimmer: "from-transparent via-[#1F5C4A]/10 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    glass: {
      container:
        "bg-[#141A2E]/80 backdrop-blur-md border border-white/15 text-[#D7DCEC] hover:text-white",
      accent: "text-[#7FE3D4]",
      shimmer: "from-transparent via-white/20 to-transparent",
      shadow: "shadow-lg hover:shadow-xl",
    },
    neo_brutalist: {
      container: "bg-white border-[3px] border-black text-black font-bold",
      accent: "text-[#1F3BFF]",
      shimmer: "from-transparent via-[#FFD400]/40 to-transparent",
      shadow: "shadow-[4px_4px_0_0_#000] hover:shadow-[6px_6px_0_0_#000]",
    },
    bento: {
      container: "bg-white/90 border border-[#1A1C20]/10 text-[#1A1C20]/70 hover:text-[#1A1C20]",
      accent: "text-[#1F4E3D]",
      shimmer: "from-transparent via-[#F4D35E]/40 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    spotlight: {
      container: "bg-[#E9E7F2]/95 border-2 border-[#22163A] text-[#22163A]/80 hover:text-[#22163A]",
      accent: "text-[#22163A]",
      shimmer: "from-transparent via-[#FFD95A]/50 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    midnight: {
      container:
        "bg-[#0F1633]/90 backdrop-blur-md border border-[#D4B26A]/25 text-[#C9CEE4] hover:text-[#EDE6D6]",
      accent: "text-[#D4B26A]",
      shimmer: "from-transparent via-[#D4B26A]/20 to-transparent",
      shadow: "shadow-lg hover:shadow-xl",
    },
    bold_corporate: {
      container: "bg-white/95 border border-[#0E2A47]/20 text-[#1B2430]/70 hover:text-[#0E2A47]",
      accent: "text-[#0E2A47]",
      shimmer: "from-transparent via-[#0E2A47]/10 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    dev_terminal: {
      container:
        "bg-[#2d333b]/95 backdrop-blur-md border border-[#444c56] text-[#adbac7] hover:text-white",
      accent: "text-[#539bf5]",
      shimmer: "from-transparent via-[#539bf5]/20 to-transparent",
      shadow: "shadow-lg hover:shadow-xl",
    },
    design_folio: {
      container: "bg-white/95 border-2 border-black text-black/70 hover:text-black",
      accent: "text-[#2D3BFF]",
      shimmer: "from-transparent via-[#2D3BFF]/15 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    classic_ats: {
      container: "bg-white/95 border border-[#B9BCC2] text-[#3F434A] hover:text-[#22385C]",
      accent: "text-[#22385C]",
      shimmer: "from-transparent via-[#22385C]/10 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
  } as const satisfies Record<
    ThemeId,
    { container: string; accent: string; shimmer: string; shadow: string }
  >;

  const isValidTheme = (t: string): t is ThemeId => {
    return t in themeStyles;
  };

  const currentTheme = isValidTheme(theme) ? themeStyles[theme] : themeStyles.bento;

  return (
    <Link
      href="/"
      className={`
        group fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-30
        px-3 py-2 sm:px-4 sm:py-3 rounded-lg
        flex items-center gap-2
        transition-colors duration-300
        overflow-hidden
        ${currentTheme.container}
        ${currentTheme.shadow}
      `}
      aria-label={`Visit ${siteConfig.fullName} homepage`}
    >
      <div
        className={`
          absolute inset-0 bg-linear-to-r
          -translate-x-full group-hover:translate-x-full
          transition-transform duration-700 ease-out
          ${currentTheme.shimmer}
        `}
      />

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
