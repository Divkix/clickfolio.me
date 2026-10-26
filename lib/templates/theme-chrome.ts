/**
 * Keep CTA, share, attribution and preview background styling in this single theme table.
 * Server-loaded public/preview pages select THEME_CHROME[themeId]; pass the selected cta,
 * share and attribution entries as props where needed (templates require share).
 * CreateYoursCTA, ShareBar, SharePopover and AttributionWidget only import its type:
 * only dashboard ThemeSelector value-imports the full table on the client.
 * Do not introduce separate per-theme maps in those components.
 */
import type { ThemeId } from "@/lib/templates/theme-ids";

export interface ThemeChrome {
  cta: { container: string; button: string; closeButton: string };
  attribution: { container: string; accent: string; shimmer: string; shadow: string };
  share: {
    variant: string;
    button: string;
    trigger: string;
    panel: string;
    item: string;
    linkedInIcon: "black" | "white";
  };
  background: { bg: string; isDark: boolean };
}

export const THEME_CHROME = {
  minimalist_editorial: {
    cta: {
      container: "bg-[#1B1B1F] text-white border border-[#1B1B1F]",
      button: "bg-white text-[#1B1B1F] hover:bg-[#F4F4F5]",
      closeButton: "hover:bg-white/10 text-white/60",
    },
    attribution: {
      container: "bg-white/95 border border-[#E4E4E7] text-[#6B6B73] hover:text-[#1B1B1F]",
      accent: "text-[#1F5C4A]",
      shimmer: "from-transparent via-[#1F5C4A]/10 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "minimalist-editorial",
      button:
        "text-[#6B6B73] hover:text-[#1F5C4A] border border-[#E4E4E7] rounded-full px-3 py-1.5 text-sm hover:border-[#1F5C4A]/40",
      trigger:
        "bg-white text-[#1B1B1F] border-[#E4E4E7] hover:text-[#1F5C4A] hover:border-[#1F5C4A]/40",
      panel: "bg-white text-[#1B1B1F] border-[#E4E4E7]",
      item: "bg-white text-[#6B6B73] hover:text-[#1F5C4A] border border-[#E4E4E7] hover:border-[#1F5C4A]/40",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-white",
      isDark: false,
    },
  },
  neo_brutalist: {
    cta: {
      container: "bg-white text-black border-[3px] border-black shadow-[4px_4px_0_0_#000]",
      button: "bg-[#FFD400] text-black hover:bg-[#FFE14D] font-bold",
      closeButton: "hover:bg-black/10 text-black",
    },
    attribution: {
      container: "bg-white border-[3px] border-black text-black font-bold",
      accent: "text-[#1F3BFF]",
      shimmer: "from-transparent via-[#FFD400]/40 to-transparent",
      shadow: "shadow-[4px_4px_0_0_#000] hover:shadow-[6px_6px_0_0_#000]",
    },
    share: {
      variant: "neo-brutalist",
      button:
        "bg-white text-black border-[3px] border-black px-3 py-1.5 font-bold shadow-[3px_3px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none",
      trigger:
        "bg-white text-black border-[3px] border-black font-bold shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]",
      panel: "bg-white text-black border-[3px] border-black shadow-[6px_6px_0_0_#000]",
      item: "bg-white text-black border-2 border-black font-bold hover:bg-[#FFD400]",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-[#FFD400]",
      isDark: false,
    },
  },
  glass: {
    cta: {
      container: "bg-[#141A2E]/80 backdrop-blur-md border border-white/15 text-white",
      button: "bg-white/20 text-white hover:bg-white/30",
      closeButton: "hover:bg-white/10 text-white/60",
    },
    attribution: {
      container:
        "bg-[#141A2E]/80 backdrop-blur-md border border-white/15 text-[#D7DCEC] hover:text-white",
      accent: "text-[#7FE3D4]",
      shimmer: "from-transparent via-white/20 to-transparent",
      shadow: "shadow-lg hover:shadow-xl",
    },
    share: {
      variant: "glass-morphic",
      button:
        "bg-white/[0.07] backdrop-blur-md border border-white/15 text-[#D7DCEC] hover:text-white hover:bg-white/[0.14] rounded-full px-3.5 py-1.5",
      trigger:
        "bg-white/[0.08] text-[#F4F6FB] border-white/20 backdrop-blur-md hover:bg-white/[0.16] rounded-full",
      panel: "bg-[#141A2E]/80 text-[#F4F6FB] border-white/15 backdrop-blur-xl",
      item: "bg-white/[0.06] text-[#D7DCEC] hover:text-white hover:bg-white/[0.14] border border-white/15",
      linkedInIcon: "white",
    },
    background: {
      bg: "bg-[#0B0F1A]",
      isDark: true,
    },
  },
  bento: {
    cta: {
      container: "bg-[#1F4E3D] text-[#F4F5F1] border border-[#1F4E3D]",
      button: "bg-[#F4D35E] text-[#1A1C20] hover:bg-[#F7DD7E]",
      closeButton: "hover:bg-white/10 text-[#F4F5F1]/70",
    },
    attribution: {
      container: "bg-white/90 border border-[#1A1C20]/10 text-[#1A1C20]/70 hover:text-[#1A1C20]",
      accent: "text-[#1F4E3D]",
      shimmer: "from-transparent via-[#F4D35E]/40 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "bento-grid",
      button:
        "bg-[#1A1C20]/10 text-[#1A1C20] hover:bg-[#1A1C20]/20 rounded-full px-3 py-1.5 text-sm font-medium",
      trigger: "bg-[#1F4E3D] text-[#F4F5F1] border-[#1F4E3D] hover:bg-[#173D30]",
      panel: "bg-[#F4D35E] text-[#1A1C20] border-[#1A1C20]/15",
      item: "bg-white/60 text-[#1A1C20] hover:bg-white border border-[#1A1C20]/10",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-[#E4E7E1]",
      isDark: false,
    },
  },
  spotlight: {
    cta: {
      container: "bg-[#170E10] text-[#F3E9D8] border border-[#E8A93B]/50",
      button: "bg-[#FFF1CF] text-[#170E10] hover:bg-[#FFE3A6]",
      closeButton: "hover:bg-white/10 text-[#F3E9D8]/70",
    },
    attribution: {
      container:
        "bg-[#170E10]/95 border border-[#E8A93B]/50 text-[#F3E9D8]/80 hover:text-[#FFF1CF]",
      accent: "text-[#E8A93B]",
      shimmer: "from-transparent via-[#FFF1CF]/20 to-transparent",
      shadow: "shadow-lg hover:shadow-xl",
    },
    share: {
      variant: "spotlight",
      button:
        "bg-transparent text-[#F3E9D8] hover:bg-[#FFF1CF] hover:text-[#170E10] border border-[#E8A93B]/60 hover:border-[#FFF1CF] rounded-full px-3 py-1.5 text-sm font-medium",
      trigger: "bg-[#170E10] text-[#FFF1CF] border-[#E8A93B]/60 shadow-lg hover:border-[#FFF1CF]",
      panel: "bg-[#170E10] text-[#F3E9D8] border-[#E8A93B]/50",
      item: "bg-transparent text-[#F3E9D8] hover:bg-[#FFF1CF] hover:text-[#170E10] border border-[#E8A93B]/50 rounded-full",
      linkedInIcon: "white",
    },
    background: {
      bg: "bg-[#170E10]",
      isDark: true,
    },
  },
  midnight: {
    cta: {
      container: "bg-[#0F1633] text-[#EDE6D6] border border-[#D4B26A]/30",
      button: "bg-[#D4B26A] text-[#0B1026] hover:bg-[#E0C487]",
      closeButton: "hover:bg-[#D4B26A]/15 text-[#D4B26A]",
    },
    attribution: {
      container:
        "bg-[#0F1633]/90 backdrop-blur-md border border-[#D4B26A]/25 text-[#C9CEE4] hover:text-[#EDE6D6]",
      accent: "text-[#D4B26A]",
      shimmer: "from-transparent via-[#D4B26A]/20 to-transparent",
      shadow: "shadow-lg hover:shadow-xl",
    },
    share: {
      variant: "midnight",
      button:
        "bg-transparent text-[#C9CEE4] hover:text-[#D4B26A] border border-[#D4B26A]/30 hover:border-[#D4B26A]/70 rounded-full px-3.5 py-1.5",
      trigger: "bg-[#131B3D] text-[#EDE6D6] border-[#D4B26A]/40 shadow-lg hover:border-[#D4B26A]",
      panel: "bg-[#0F1633]/95 text-[#EDE6D6] border-[#D4B26A]/30",
      item: "bg-[#131B3D] text-[#C9CEE4] hover:text-[#D4B26A] border border-[#D4B26A]/25 hover:border-[#D4B26A]/60",
      linkedInIcon: "white",
    },
    background: {
      bg: "bg-[#0B1026]",
      isDark: true,
    },
  },
  bold_corporate: {
    cta: {
      container: "bg-[#0E2A47] text-white border border-[#0E2A47]",
      button: "bg-white text-[#0E2A47] hover:bg-[#EEF2F6]",
      closeButton: "hover:bg-white/10 text-white/60",
    },
    attribution: {
      container: "bg-white/95 border border-[#0E2A47]/20 text-[#1B2430]/70 hover:text-[#0E2A47]",
      accent: "text-[#0E2A47]",
      shimmer: "from-transparent via-[#0E2A47]/10 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "bold-corporate",
      button:
        "bg-white text-[#0E2A47] hover:bg-[#EEF2F6] border border-[#0E2A47]/25 rounded-sm px-3 py-1.5 text-sm font-medium",
      trigger: "bg-[#0E2A47] text-white border-[#0E2A47] hover:bg-[#0A2038]",
      panel: "bg-white text-[#1B2430] border-[#0E2A47]/25",
      item: "bg-white text-[#0E2A47] hover:bg-[#EEF2F6] border-[#0E2A47]/25",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-white",
      isDark: false,
    },
  },
  classic_ats: {
    cta: {
      container: "bg-white text-[#1F2328] border border-[#B9BCC2]",
      button: "bg-[#22385C] text-white hover:bg-[#2D4874]",
      closeButton: "hover:bg-gray-100 text-gray-500",
    },
    attribution: {
      container: "bg-white/95 border border-[#B9BCC2] text-[#3F434A] hover:text-[#22385C]",
      accent: "text-[#22385C]",
      shimmer: "from-transparent via-[#22385C]/10 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "classic-ats",
      button:
        "bg-white text-[#3F434A] hover:text-[#22385C] border border-[#B9BCC2] rounded-[3px] px-3 py-1.5 text-sm hover:border-[#22385C]",
      trigger: "bg-white text-[#22385C] border-[#B9BCC2] shadow-sm hover:border-[#22385C]",
      panel: "bg-white text-[#16181D] border-[#B9BCC2]",
      item: "bg-white text-[#3F434A] hover:text-[#22385C] border-[#B9BCC2]",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-[#D9DBDE]",
      isDark: false,
    },
  },
  design_folio: {
    cta: {
      container: "bg-[#2D3BFF] text-white border border-[#2D3BFF]",
      button: "bg-white text-black hover:bg-[#EDEEF0]",
      closeButton: "hover:bg-white/10 text-white/70",
    },
    attribution: {
      container: "bg-white/95 border-2 border-black text-black/70 hover:text-black",
      accent: "text-[#2D3BFF]",
      shimmer: "from-transparent via-[#2D3BFF]/15 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "design-folio",
      button:
        "bg-white text-black border-2 border-white hover:bg-black hover:text-white hover:border-black px-3 py-1.5 font-semibold",
      trigger:
        "bg-[#1a1a1a] text-[#CCFF00] border-[#333] shadow-lg font-mono hover:border-[#CCFF00]",
      panel: "bg-white text-black border-2 border-black",
      item: "bg-white text-black hover:bg-[#2D3BFF] hover:text-white border-2 border-black",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-[#EDEEF0]",
      isDark: false,
    },
  },
  dev_terminal: {
    cta: {
      container: "bg-[#2d333b] text-[#adbac7] border border-[#444c56]",
      button: "bg-[#347d39] text-white hover:bg-[#46954a]",
      closeButton: "hover:bg-[#444c56] text-[#768390]",
    },
    attribution: {
      container:
        "bg-[#2d333b]/95 backdrop-blur-md border border-[#444c56] text-[#adbac7] hover:text-white",
      accent: "text-[#539bf5]",
      shimmer: "from-transparent via-[#539bf5]/20 to-transparent",
      shadow: "shadow-lg hover:shadow-xl",
    },
    share: {
      variant: "dev-terminal",
      button:
        "bg-[#2d333b] text-[#adbac7] hover:text-[#cdd9e5] hover:bg-[#373e47] border border-[#444c56] rounded-md px-3 py-1.5",
      trigger: "bg-[#2d333b] text-[#cdd9e5] border-[#444c56] shadow-lg hover:bg-[#373e47]",
      panel: "bg-[#2d333b] text-[#adbac7] border-[#444c56]",
      item: "bg-[#22272e] text-[#adbac7] hover:text-[#cdd9e5] hover:bg-[#373e47] border border-[#444c56]",
      linkedInIcon: "white",
    },
    background: {
      bg: "bg-[#22272e]",
      isDark: true,
    },
  },
  case_file: {
    cta: {
      container: "bg-[#2F2A26] text-[#FBF7EE] border border-[#D9BF83]/40",
      button: "bg-[#D9BF83] text-[#2F2A26] hover:bg-[#E4CD97]",
      closeButton: "hover:bg-white/10 text-[#FBF7EE]/70",
    },
    attribution: {
      container: "bg-[#FBF7EE]/95 border border-[#1F1D1A]/25 text-[#6A6358] hover:text-[#1F1D1A]",
      accent: "text-[#B3261E]",
      shimmer: "from-transparent via-[#D9BF83]/40 to-transparent",
      shadow: "shadow-md hover:shadow-lg",
    },
    share: {
      variant: "case-file",
      button:
        "bg-transparent text-[#1F1D1A] hover:text-[#B3261E] border border-[#1F1D1A]/40 hover:border-[#B3261E] rounded-sm px-3 py-1.5 text-sm",
      trigger: "bg-[#FBF7EE] text-[#1F1D1A] border-[#1F1D1A]/40 rounded-sm hover:border-[#B3261E]",
      panel: "bg-[#FBF7EE] text-[#1F1D1A] border-[#1F1D1A]/30 rounded-sm",
      item: "bg-[#FBF7EE] text-[#1F1D1A] hover:text-[#B3261E] border border-[#1F1D1A]/25 hover:border-[#B3261E]",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-[#2F2A26]",
      isDark: true,
    },
  },
  retro_os: {
    cta: {
      container:
        "bg-[#C0C0C0] text-black rounded-none shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#fff,inset_-2px_-2px_#808080,inset_2px_2px_#dfdfdf]",
      button: "bg-[#000080] text-white rounded-none hover:bg-[#1084D0]",
      closeButton: "hover:bg-black/10 text-black rounded-none",
    },
    attribution: {
      container:
        "bg-[#C0C0C0] text-black border-2 border-t-white border-l-white border-r-[#0a0a0a] border-b-[#0a0a0a]",
      accent: "text-[#000080]",
      shimmer: "from-transparent via-white/40 to-transparent",
      shadow: "shadow-none",
    },
    share: {
      variant: "retro-os",
      button:
        "bg-[#C0C0C0] text-black px-3 py-1 text-sm shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#fff,inset_-2px_-2px_#808080,inset_2px_2px_#dfdfdf] active:shadow-[inset_1px_1px_#0a0a0a,inset_-1px_-1px_#fff]",
      trigger:
        "bg-[#C0C0C0] text-black border-0 rounded-none shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#fff,inset_-2px_-2px_#808080,inset_2px_2px_#dfdfdf]",
      panel:
        "bg-[#C0C0C0] text-black border-2 border-t-white border-l-white border-r-[#0a0a0a] border-b-[#0a0a0a] rounded-none",
      item: "bg-white text-black hover:bg-[#000080] hover:text-white border border-[#808080] rounded-none",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-[#008080]",
      isDark: true,
    },
  },
  boardroom: {
    cta: {
      container: "bg-[#161B22] text-[#ECE6D8] border border-[#C4A971]/40",
      button: "bg-[#C4A971] text-[#0F1318] hover:bg-[#D3BC8A]",
      closeButton: "hover:bg-white/10 text-[#ECE6D8]/70",
    },
    attribution: {
      container:
        "bg-[#161B22]/95 backdrop-blur-md border border-[#262D37] text-[#98A0AB] hover:text-[#ECE6D8]",
      accent: "text-[#C4A971]",
      shimmer: "from-transparent via-[#C4A971]/20 to-transparent",
      shadow: "shadow-lg hover:shadow-xl",
    },
    share: {
      variant: "boardroom",
      button:
        "bg-transparent text-[#ECE6D8] hover:text-[#C4A971] border border-[#262D37] hover:border-[#C4A971]/60 rounded-sm px-3 py-1.5 text-sm",
      trigger: "bg-[#161B22] text-[#ECE6D8] border-[#262D37] rounded-sm hover:border-[#C4A971]/60",
      panel: "bg-[#161B22] text-[#ECE6D8] border-[#262D37] rounded-sm",
      item: "bg-[#0F1318] text-[#ECE6D8] hover:text-[#C4A971] border border-[#262D37] hover:border-[#C4A971]/60",
      linkedInIcon: "white",
    },
    background: {
      bg: "bg-[#0F1318]",
      isDark: true,
    },
  },
  broadsheet: {
    cta: {
      container: "bg-[#1B1613] text-[#F3E5D9] border border-[#1B1613]",
      button: "bg-[#F3E5D9] text-[#1B1613] hover:bg-white",
      closeButton: "hover:bg-white/10 text-[#F3E5D9]/70",
    },
    attribution: {
      container: "bg-[#F8EEE5]/95 border border-[#1B1613]/30 text-[#66584F] hover:text-[#1B1613]",
      accent: "text-[#8A2C27]",
      shimmer: "from-transparent via-[#8A2C27]/10 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "broadsheet",
      button:
        "bg-transparent text-[#1B1613] hover:text-[#8A2C27] border border-[#1B1613]/40 hover:border-[#8A2C27] rounded-none px-3 py-1.5 text-sm",
      trigger:
        "bg-[#F8EEE5] text-[#1B1613] border-[#1B1613]/40 rounded-none hover:border-[#8A2C27]",
      panel: "bg-[#F8EEE5] text-[#1B1613] border-[#1B1613]/30 rounded-none",
      item: "bg-[#F8EEE5] text-[#1B1613] hover:text-[#8A2C27] border border-[#1B1613]/25 hover:border-[#8A2C27]",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-[#F3E5D9]",
      isDark: false,
    },
  },
  academic_cv: {
    cta: {
      container: "bg-[#14202F] text-white border border-[#14202F]",
      button: "bg-white text-[#14202F] hover:bg-[#EEF1F5]",
      closeButton: "hover:bg-white/10 text-white/60",
    },
    attribution: {
      container: "bg-white/95 border border-[#DAD9D2] text-[#4D5766] hover:text-[#14202F]",
      accent: "text-[#1D4E89]",
      shimmer: "from-transparent via-[#1D4E89]/10 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "academic-cv",
      button:
        "text-[#4D5766] hover:text-[#1D4E89] border border-[#DAD9D2] rounded-sm px-3 py-1.5 text-sm hover:border-[#1D4E89]/50",
      trigger:
        "bg-white text-[#14202F] border-[#DAD9D2] rounded-sm hover:text-[#1D4E89] hover:border-[#1D4E89]/50",
      panel: "bg-white text-[#14202F] border-[#DAD9D2] rounded-sm",
      item: "bg-white text-[#4D5766] hover:text-[#1D4E89] border border-[#DAD9D2] hover:border-[#1D4E89]/50",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-[#FAFAF7]",
      isDark: false,
    },
  },
  contact_sheet: {
    cta: {
      container: "bg-[#1A1A1C] text-[#ECE8DF] border border-[#FF6B2C]/50",
      button: "bg-[#FF6B2C] text-[#0F0F10] hover:bg-[#FF8451]",
      closeButton: "hover:bg-white/10 text-[#ECE8DF]/70",
    },
    attribution: {
      container:
        "bg-[#1A1A1C]/95 backdrop-blur-md border border-[#2A2A2D] text-[#9A968D] hover:text-[#ECE8DF]",
      accent: "text-[#FF6B2C]",
      shimmer: "from-transparent via-[#FF6B2C]/20 to-transparent",
      shadow: "shadow-lg hover:shadow-xl",
    },
    share: {
      variant: "contact-sheet",
      button:
        "bg-transparent text-[#ECE8DF] hover:text-[#FF6B2C] border border-[#2A2A2D] hover:border-[#FF6B2C] rounded-none px-3 py-1.5 text-sm",
      trigger: "bg-[#1A1A1C] text-[#ECE8DF] border-[#2A2A2D] rounded-none hover:border-[#FF6B2C]",
      panel: "bg-[#1A1A1C] text-[#ECE8DF] border-[#2A2A2D] rounded-none",
      item: "bg-[#121214] text-[#CFCABF] hover:text-[#FF6B2C] border border-[#2A2A2D] hover:border-[#FF6B2C]",
      linkedInIcon: "white",
    },
    background: {
      bg: "bg-[#0F0F10]",
      isDark: true,
    },
  },
  workspace: {
    cta: {
      container: "bg-[#37352F] text-white border border-[#37352F]",
      button: "bg-white text-[#37352F] hover:bg-[#F7F7F5]",
      closeButton: "hover:bg-white/10 text-white/60",
    },
    attribution: {
      container: "bg-white/95 border border-[#E9E9E7] text-[#787774] hover:text-[#37352F]",
      accent: "text-[#2383E2]",
      shimmer: "from-transparent via-[#2383E2]/10 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "workspace",
      button:
        "bg-white text-[#787774] hover:text-[#37352F] hover:bg-[#F7F7F5] border border-[#E9E9E7] rounded-md px-3 py-1.5 text-sm",
      trigger: "bg-white text-[#37352F] border-[#E9E9E7] rounded-md shadow-sm hover:bg-[#F7F7F5]",
      panel: "bg-white text-[#37352F] border-[#E9E9E7] rounded-md",
      item: "bg-white text-[#787774] hover:text-[#37352F] hover:bg-[#F7F7F5] border border-[#E9E9E7]",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-white",
      isDark: false,
    },
  },
  blueprint: {
    cta: {
      container: "bg-[#0B3158] text-[#EAF3FF] border border-[#EAF3FF]/60",
      button: "bg-[#FFD966] text-[#0E3A66] hover:bg-[#FFE38A]",
      closeButton: "hover:bg-white/10 text-[#EAF3FF]/70",
    },
    attribution: {
      container:
        "bg-[#0E3A66]/95 backdrop-blur-md border border-[#EAF3FF]/50 text-[#BFD9F6] hover:text-white",
      accent: "text-[#FFD966]",
      shimmer: "from-transparent via-[#FFD966]/20 to-transparent",
      shadow: "shadow-lg hover:shadow-xl",
    },
    share: {
      variant: "blueprint",
      button:
        "bg-transparent text-[#EAF3FF] hover:text-[#FFD966] border border-[#EAF3FF]/50 hover:border-[#FFD966] rounded-none px-3 py-1.5 text-sm",
      trigger:
        "bg-[#0E3A66] text-[#EAF3FF] border-[#EAF3FF]/60 rounded-none shadow-lg hover:border-[#FFD966]",
      panel: "bg-[#0E3A66] text-[#EAF3FF] border-[#EAF3FF]/60 rounded-none",
      item: "bg-[#0B3158] text-[#DCEBFB] hover:text-[#FFD966] border border-[#EAF3FF]/40 hover:border-[#FFD966]",
      linkedInIcon: "white",
    },
    background: {
      bg: "bg-[#0E3A66]",
      isDark: true,
    },
  },
  scrapbook: {
    cta: {
      container:
        "bg-[#FFD84D] text-[#2B2622] border-2 border-[#2B2622] shadow-[3px_3px_0_0_#2B2622]",
      button: "bg-[#2B2622] text-[#FFFDF8] hover:bg-[#443C35]",
      closeButton: "hover:bg-black/10 text-[#2B2622]",
    },
    attribution: {
      container: "bg-[#FFFDF8]/95 border-2 border-[#2B2622] text-[#5B524A] hover:text-[#2B2622]",
      accent: "text-[#E5533D]",
      shimmer: "from-transparent via-[#FFD84D]/50 to-transparent",
      shadow: "shadow-[3px_3px_0_0_#2B2622] hover:shadow-[4px_4px_0_0_#2B2622]",
    },
    share: {
      variant: "scrapbook",
      button:
        "bg-white text-[#2B2622] hover:bg-[#FFD84D] border-2 border-[#2B2622] rounded-full px-3 py-1.5 text-sm font-medium shadow-[2px_2px_0_0_#2B2622]",
      trigger:
        "bg-[#FFD84D] text-[#2B2622] border-2 border-[#2B2622] rounded-full shadow-[3px_3px_0_0_#2B2622] hover:bg-[#FFE57F]",
      panel:
        "bg-[#FFFDF8] text-[#2B2622] border-2 border-[#2B2622] rounded-lg shadow-[4px_4px_0_0_#2B2622]",
      item: "bg-white text-[#2B2622] hover:bg-[#BFE3D0] border-2 border-[#2B2622] rounded-full",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-[#F1E6D3]",
      isDark: false,
    },
  },
  media_kit: {
    cta: {
      container: "bg-[#2A0B22] text-[#FBEAEE] border border-[#FF9EC1]/40",
      button: "bg-[#FF9EC1] text-[#2A0B22] hover:bg-white",
      closeButton: "hover:bg-white/10 text-[#FBEAEE]/70",
    },
    attribution: {
      container: "bg-[#FBEAEE]/95 border border-[#2A0B22]/30 text-[#6E4A60] hover:text-[#2A0B22]",
      accent: "text-[#C0175A]",
      shimmer: "from-transparent via-[#FF9EC1]/40 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "media-kit",
      button:
        "bg-transparent text-[#FBEAEE] hover:text-[#2A0B22] hover:bg-[#FF9EC1] border border-[#FBEAEE]/40 hover:border-[#FF9EC1] rounded-none px-3 py-1.5 text-sm",
      trigger:
        "bg-[#2A0B22] text-[#FBEAEE] border-[#FF9EC1]/60 rounded-none shadow-lg hover:border-[#FF9EC1]",
      panel: "bg-[#2A0B22] text-[#FBEAEE] border-[#FF9EC1]/50 rounded-none",
      item: "bg-[#3A1530] text-[#FBEAEE] hover:text-[#2A0B22] hover:bg-[#FF9EC1] border border-[#FBEAEE]/20 rounded-none",
      linkedInIcon: "white",
    },
    background: {
      bg: "bg-[#FBEAEE]",
      isDark: false,
    },
  },
  liner_notes: {
    cta: {
      container: "bg-[#1D2A33] text-[#EEF2EF] border border-[#1D2A33]",
      button: "bg-[#C8412F] text-[#EEF2EF] hover:bg-[#D9584A]",
      closeButton: "hover:bg-white/10 text-[#EEF2EF]/70",
    },
    attribution: {
      container: "bg-[#EEF2EF]/95 border border-[#1D2A33]/20 text-[#51616B] hover:text-[#1D2A33]",
      accent: "text-[#C8412F]",
      shimmer: "from-transparent via-[#C8412F]/15 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "liner-notes",
      button:
        "bg-transparent text-[#EEF2EF] hover:bg-[#C8412F] border border-[#EEF2EF]/40 hover:border-[#C8412F] rounded-full px-3 py-1.5 text-sm",
      trigger:
        "bg-[#1D2A33] text-[#EEF2EF] border-[#C8412F]/60 rounded-full shadow-lg hover:border-[#C8412F]",
      panel: "bg-[#EEF2EF] text-[#1D2A33] border-[#1D2A33]/25 rounded-sm",
      item: "bg-white text-[#1D2A33] hover:bg-[#C8412F] hover:text-[#EEF2EF] border border-[#1D2A33]/20 rounded-full",
      linkedInIcon: "white",
    },
    background: {
      bg: "bg-[#C9D6CF]",
      isDark: false,
    },
  },
  rounds: {
    cta: {
      container: "bg-[#123B4A] text-[#E7EFF3] border border-[#123B4A]",
      button: "bg-[#E06D5A] text-white hover:bg-[#E88473]",
      closeButton: "hover:bg-white/10 text-[#E7EFF3]/70",
    },
    attribution: {
      container: "bg-white/95 border border-[#C9D9E1] text-[#4C6470] hover:text-[#123B4A]",
      accent: "text-[#E06D5A]",
      shimmer: "from-transparent via-[#8FB3C9]/40 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "rounds",
      button:
        "bg-white text-[#123B4A] hover:bg-[#123B4A] hover:text-white border border-[#C9D9E1] hover:border-[#123B4A] rounded-full px-3 py-1.5 text-sm",
      trigger:
        "bg-[#123B4A] text-[#E7EFF3] border-[#E06D5A]/50 rounded-full shadow-md hover:border-[#E06D5A]",
      panel: "bg-white text-[#123B4A] border-[#C9D9E1] rounded-xl",
      item: "bg-[#E7EFF3] text-[#123B4A] hover:bg-[#123B4A] hover:text-white border border-[#C9D9E1] rounded-full",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-[#E7EFF3]",
      isDark: false,
    },
  },
  lesson_plan: {
    cta: {
      container: "bg-[#24303A] text-[#FCFCF8] border border-[#24303A]",
      button: "bg-[#FFE37A] text-[#24303A] hover:bg-[#FFEC9E]",
      closeButton: "hover:bg-white/10 text-[#FCFCF8]/70",
    },
    attribution: {
      container: "bg-[#FCFCF8]/95 border border-[#3F6E5C]/25 text-[#5B6770] hover:text-[#24303A]",
      accent: "text-[#E0675F]",
      shimmer: "from-transparent via-[#FFE37A]/50 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "lesson-plan",
      button:
        "bg-transparent text-[#FCFCF8] hover:text-[#24303A] hover:bg-[#FFE37A] border border-[#FCFCF8]/40 hover:border-[#FFE37A] rounded-md px-3 py-1.5 text-sm",
      trigger:
        "bg-[#24303A] text-[#FCFCF8] border-[#F2B33D]/60 rounded-md shadow-lg hover:border-[#F2B33D]",
      panel: "bg-[#FCFCF8] text-[#24303A] border-[#B9D0E6] rounded-md",
      item: "bg-white text-[#24303A] hover:bg-[#FFE37A] border border-[#B9D0E6] rounded-md",
      linkedInIcon: "white",
    },
    background: {
      bg: "bg-[#3F6E5C]",
      isDark: true,
    },
  },
  manuscript: {
    cta: {
      container: "bg-[#22201C] text-[#FBFAF7] border border-[#7A1F2B]/40",
      button: "bg-[#7A1F2B] text-[#FBFAF7] hover:bg-[#8F2836]",
      closeButton: "hover:bg-white/10 text-[#FBFAF7]/70",
    },
    attribution: {
      container:
        "bg-[#3B4A52]/95 backdrop-blur-md border border-[#FBFAF7]/20 text-[#C9C4BB] hover:text-[#FBFAF7]",
      accent: "text-[#D9A6AE]",
      shimmer: "from-transparent via-[#7A1F2B]/40 to-transparent",
      shadow: "shadow-lg hover:shadow-xl",
    },
    share: {
      variant: "manuscript",
      button:
        "bg-transparent text-[#FBFAF7] hover:bg-[#7A1F2B] border border-[#FBFAF7]/40 hover:border-[#7A1F2B] rounded-none px-3 py-1.5 text-sm",
      trigger:
        "bg-[#22201C] text-[#FBFAF7] border-[#7A1F2B]/60 rounded-none shadow-lg hover:border-[#7A1F2B]",
      panel: "bg-[#FBFAF7] text-[#22201C] border-[#7A1F2B]/30 rounded-none",
      item: "bg-white text-[#22201C] hover:bg-[#7A1F2B] hover:text-[#FBFAF7] border border-[#22201C]/20 rounded-none",
      linkedInIcon: "white",
    },
    background: {
      bg: "bg-[#3B4A52]",
      isDark: true,
    },
  },
  gallery_wall: {
    cta: {
      container: "bg-[#2A2A2A] text-[#F1F0EC] border border-[#2A2A2A]",
      button: "bg-[#B8875A] text-white hover:bg-[#C79868]",
      closeButton: "hover:bg-white/10 text-[#F1F0EC]/70",
    },
    attribution: {
      container: "bg-white/95 border border-[#2A2A2A]/15 text-[#77756F] hover:text-[#2A2A2A]",
      accent: "text-[#B8875A]",
      shimmer: "from-transparent via-[#B8875A]/20 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "gallery-wall",
      button:
        "bg-transparent text-[#2A2A2A] hover:bg-[#2A2A2A] hover:text-[#F1F0EC] border border-[#2A2A2A]/30 hover:border-[#2A2A2A] rounded-none px-3 py-1.5 text-sm",
      trigger:
        "bg-[#2A2A2A] text-[#F1F0EC] border-[#B8875A]/60 rounded-none shadow-lg hover:border-[#B8875A]",
      panel: "bg-white text-[#2A2A2A] border-[#B8875A]/40 rounded-none",
      item: "bg-[#F1F0EC] text-[#2A2A2A] hover:bg-[#B8875A] hover:text-white border border-[#2A2A2A]/15 rounded-none",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-[#F1F0EC]",
      isDark: false,
    },
  },
  quota: {
    cta: {
      container: "bg-[#1F1C19] text-white border border-[#E8491D]/40",
      button: "bg-[#E8491D] text-white hover:bg-[#F15F34]",
      closeButton: "hover:bg-white/10 text-white/70",
    },
    attribution: {
      container: "bg-white/95 border border-[#1F1C19]/20 text-[#5A5450] hover:text-[#1F1C19]",
      accent: "text-[#E8491D]",
      shimmer: "from-transparent via-[#E8491D]/20 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "quota",
      button:
        "bg-transparent text-[#1F1C19] hover:bg-[#E8491D] hover:text-white border border-[#1F1C19]/30 rounded-sm px-3 py-1.5 text-sm",
      trigger: "bg-[#1F1C19] text-white border-[#E8491D]/60 rounded-sm shadow-lg",
      panel: "bg-[#FBFAF8] text-[#1F1C19] border-[#1F1C19]/30 rounded-sm",
      item: "bg-white text-[#1F1C19] hover:bg-[#E8491D] hover:text-white border border-[#1F1C19]/20",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-[#FBFAF8]",
      isDark: false,
    },
  },
  the_brief: {
    cta: {
      container: "bg-[#1B2A4A] text-white border border-[#B08D3D]/40",
      button: "bg-[#B08D3D] text-[#1B2A4A] hover:bg-[#C19E52]",
      closeButton: "hover:bg-white/10 text-white/70",
    },
    attribution: {
      container: "bg-[#FBF8F0]/95 border border-[#1B2A4A]/25 text-[#5B5748] hover:text-[#1B2A4A]",
      accent: "text-[#B08D3D]",
      shimmer: "from-transparent via-[#B08D3D]/20 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "the-brief",
      button:
        "bg-transparent text-[#1B2A4A] hover:bg-[#1B2A4A] hover:text-white border border-[#1B2A4A]/40 rounded-sm px-3 py-1.5 text-sm",
      trigger: "bg-[#FBF8F0] text-[#1B2A4A] border-[#1B2A4A]/40 rounded-sm shadow-md",
      panel: "bg-[#FBF8F0] text-[#1C1A16] border-[#1B2A4A]/30 rounded-sm",
      item: "bg-[#FBF8F0] text-[#1C1A16] hover:text-[#1B2A4A] border border-[#1B2A4A]/25",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-[#FBF8F0]",
      isDark: false,
    },
  },
  open_house: {
    cta: {
      container: "bg-[#1F4D3A] text-white border border-[#1F4D3A]",
      button: "bg-white text-[#1F4D3A] hover:bg-[#E1E7E2]",
      closeButton: "hover:bg-white/10 text-white/70",
    },
    attribution: {
      container: "bg-white/95 border border-[#18231D]/20 text-[#56615A] hover:text-[#18231D]",
      accent: "text-[#1F4D3A]",
      shimmer: "from-transparent via-[#1F4D3A]/20 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "open-house",
      button:
        "bg-white text-[#1F4D3A] hover:bg-[#1F4D3A] hover:text-white border border-[#1F4D3A]/40 rounded-none px-3 py-1.5 text-sm",
      trigger: "bg-[#1F4D3A] text-white border-[#1F4D3A] rounded-none shadow-lg",
      panel: "bg-[#EEF1EE] text-[#18231D] border-[#18231D]/20 rounded-none",
      item: "bg-white text-[#18231D] hover:bg-[#1F4D3A] hover:text-white border border-[#18231D]/20",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-[#EEF1EE]",
      isDark: false,
    },
  },
  the_menu: {
    cta: {
      container: "bg-[#7A1E22] text-[#FCF8F0] border border-[#FCF8F0]/30",
      button: "bg-[#FCF8F0] text-[#7A1E22] hover:bg-[#F1E7D8]",
      closeButton: "hover:bg-white/10 text-[#FCF8F0]/75",
    },
    attribution: {
      container: "bg-[#FCF8F0]/95 border border-[#7A1E22]/30 text-[#5C4E45] hover:text-[#241A16]",
      accent: "text-[#7A1E22]",
      shimmer: "from-transparent via-[#7A1E22]/20 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "the-menu",
      button:
        "bg-transparent text-[#241A16] hover:bg-[#7A1E22] hover:text-[#FCF8F0] border border-[#7A1E22]/45 rounded-none px-3 py-1.5 text-sm",
      trigger: "bg-[#7A1E22] text-[#FCF8F0] border-[#FCF8F0]/40 rounded-none shadow-lg",
      panel: "bg-[#FCF8F0] text-[#241A16] border-[#7A1E22]/40 rounded-none",
      item: "bg-[#FCF8F0] text-[#241A16] hover:bg-[#7A1E22] hover:text-[#FCF8F0] border border-[#7A1E22]/30",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-[#F1E7D8]",
      isDark: false,
    },
  },
  personal_best: {
    cta: {
      container: "bg-black text-white border border-[#FFB01F]/40",
      button: "bg-[#B0372A] text-white hover:bg-[#C4463A]",
      closeButton: "hover:bg-white/10 text-white/70",
    },
    attribution: {
      container: "bg-white/95 border border-[#16171A]/15 text-[#55585F] hover:text-[#16171A]",
      accent: "text-[#B0372A]",
      shimmer: "from-transparent via-[#B0372A]/15 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "personal-best",
      button:
        "bg-white text-[#16171A] hover:bg-[#B0372A] hover:text-white border border-[#16171A]/25 rounded-none px-3 py-1.5 text-sm font-semibold",
      trigger: "bg-[#B0372A] text-white border-white/40 rounded-none shadow-lg",
      panel: "bg-white text-[#16171A] border-[#16171A]/15 rounded-none",
      item: "bg-[#F0F0EC] text-[#16171A] hover:bg-[#B0372A] hover:text-white border border-[#16171A]/10",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-white",
      isDark: false,
    },
  },
  pitch_deck: {
    cta: {
      container: "bg-[#2F5CFF] text-white border border-[#2F5CFF]",
      button: "bg-white text-[#2F5CFF] hover:bg-[#EEF1FF]",
      closeButton: "hover:bg-white/10 text-white/70",
    },
    attribution: {
      container: "bg-white/95 border border-[#E7E9F5] text-[#6B6F8A] hover:text-[#191B2B]",
      accent: "text-[#2F5CFF]",
      shimmer: "from-transparent via-[#2F5CFF]/15 to-transparent",
      shadow: "shadow-sm hover:shadow-md",
    },
    share: {
      variant: "pitch-deck",
      button:
        "bg-transparent text-[#2F5CFF] hover:bg-[#2F5CFF] hover:text-white border border-[#2F5CFF]/40 rounded-md px-3 py-1.5 text-sm",
      trigger: "bg-[#2F5CFF] text-white border-[#2F5CFF] rounded-md shadow-lg",
      panel: "bg-white text-[#2F5CFF] border-[#2F5CFF]/30 rounded-md",
      item: "bg-white text-[#191B2B] hover:text-[#2F5CFF] border border-[#E7E9F5]",
      linkedInIcon: "black",
    },
    background: {
      bg: "bg-[#E3E4E8]",
      isDark: false,
    },
  },
  reel: {
    cta: {
      container: "bg-[#0C0C0E] text-[#E7E6E2] border border-[#E5342B]/40",
      button: "bg-[#E5342B] text-white hover:bg-[#EF5048]",
      closeButton: "hover:bg-[#E5342B]/15 text-[#E5342B]",
    },
    attribution: {
      container:
        "bg-[#0C0C0E]/90 backdrop-blur-md border border-white/10 text-[#A8A6A0] hover:text-[#E7E6E2]",
      accent: "text-[#E5342B]",
      shimmer: "from-transparent via-[#E5342B]/20 to-transparent",
      shadow: "shadow-lg hover:shadow-xl",
    },
    share: {
      variant: "reel",
      button:
        "bg-transparent text-[#E7E6E2] hover:text-[#E5342B] border border-white/20 hover:border-[#E5342B] rounded-sm px-3 py-1.5 text-sm",
      trigger: "bg-[#0C0C0E] text-[#E7E6E2] border-[#E5342B]/50 rounded-sm shadow-lg",
      panel: "bg-[#0C0C0E] text-[#E7E6E2] border-[#E5342B]/40 rounded-sm",
      item: "bg-[#17171A] text-[#E7E6E2] hover:text-[#E5342B] border border-white/10",
      linkedInIcon: "white",
    },
    background: {
      bg: "bg-[#0C0C0E]",
      isDark: true,
    },
  },
  link_stack: {
    cta: {
      container: "bg-[#160F3D] text-white border border-white/15",
      button: "bg-[#FF9A74] text-[#160F3D] hover:bg-[#FFBE8F]",
      closeButton: "hover:bg-white/10 text-white/70",
    },
    attribution: {
      container:
        "bg-[#160F3D]/90 backdrop-blur-md border border-white/15 text-white/70 hover:text-white",
      accent: "text-[#FF9A74]",
      shimmer: "from-transparent via-[#FF9A74]/20 to-transparent",
      shadow: "shadow-lg hover:shadow-xl",
    },
    share: {
      variant: "link-stack",
      button:
        "bg-transparent text-white hover:bg-[#2A1FC7] border border-white/30 hover:border-[#2A1FC7] rounded-none px-3 py-1.5 text-sm",
      trigger: "bg-[#2A1FC7] text-white border-[#2A1FC7] rounded-none shadow-lg",
      panel: "bg-[#160F3D] text-white border-white/15 rounded-none",
      item: "bg-[#1F1752] text-white hover:bg-[#2A1FC7] border border-white/10",
      linkedInIcon: "white",
    },
    background: {
      bg: "bg-[#160F3D]",
      isDark: true,
    },
  },
} as const satisfies Record<ThemeId, ThemeChrome>;
