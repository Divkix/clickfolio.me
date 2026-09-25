export const SHARE_VARIANT_KEYS = [
  "minimalist-editorial",
  "neo-brutalist",
  "glass-morphic",
  "bento-grid",
  "spotlight",
  "midnight",
  "bold-corporate",
  "classic-ats",
  "design-folio",
  "dev-terminal",
] as const;

export type SharePopoverVariant = (typeof SHARE_VARIANT_KEYS)[number];

export const DEFAULT_SHARE_VARIANT: SharePopoverVariant = "minimalist-editorial";

export const shareContainerStyles: Record<SharePopoverVariant, string> = {
  "minimalist-editorial": "",
  "neo-brutalist": "",
  "glass-morphic": "",
  "bento-grid": "",
  spotlight: "",
  midnight: "",
  "bold-corporate": "",
  "classic-ats": "",
  "design-folio": "",
  "dev-terminal": "",
};

export const shareButtonStyles = {
  "minimalist-editorial":
    "text-[#6B6B73] hover:text-[#1F5C4A] border border-[#E4E4E7] rounded-full px-3 py-1.5 text-sm hover:border-[#1F5C4A]/40",
  "neo-brutalist":
    "bg-white text-black border-[3px] border-black px-3 py-1.5 font-bold shadow-[3px_3px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none",
  "glass-morphic":
    "bg-white/[0.07] backdrop-blur-md border border-white/15 text-[#D7DCEC] hover:text-white hover:bg-white/[0.14] rounded-full px-3.5 py-1.5",
  "bento-grid":
    "bg-[#1A1C20]/10 text-[#1A1C20] hover:bg-[#1A1C20]/20 rounded-full px-3 py-1.5 text-sm font-medium",
  spotlight:
    "bg-transparent text-[#22163A] hover:bg-[#FFD95A] border-2 border-[#22163A] rounded-full px-3 py-1.5 font-semibold",
  midnight:
    "bg-transparent text-[#C9CEE4] hover:text-[#D4B26A] border border-[#D4B26A]/30 hover:border-[#D4B26A]/70 rounded-full px-3.5 py-1.5",
  "bold-corporate":
    "bg-white text-[#0E2A47] hover:bg-[#EEF2F6] border border-[#0E2A47]/25 rounded-sm px-3 py-1.5 text-sm font-medium",
  "classic-ats":
    "bg-white text-[#3F434A] hover:text-[#22385C] border border-[#B9BCC2] rounded-[3px] px-3 py-1.5 text-sm hover:border-[#22385C]",
  "design-folio":
    "bg-white text-black border-2 border-white hover:bg-black hover:text-white hover:border-black px-3 py-1.5 font-semibold",
  "dev-terminal":
    "bg-[#2d333b] text-[#adbac7] hover:text-[#cdd9e5] hover:bg-[#373e47] border border-[#444c56] rounded-md px-3 py-1.5",
} satisfies Record<SharePopoverVariant, string>;

export const shareTriggerStyles = {
  "minimalist-editorial":
    "bg-white text-[#1B1B1F] border-[#E4E4E7] hover:text-[#1F5C4A] hover:border-[#1F5C4A]/40",
  "neo-brutalist":
    "bg-white text-black border-[3px] border-black font-bold shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]",
  "glass-morphic":
    "bg-white/[0.08] text-[#F4F6FB] border-white/20 backdrop-blur-md hover:bg-white/[0.16] rounded-full",
  "bento-grid": "bg-[#1F4E3D] text-[#F4F5F1] border-[#1F4E3D] hover:bg-[#173D30]",
  spotlight: "bg-[#22163A] text-[#FFD95A] border-[#22163A] shadow-md hover:bg-[#35255A]",
  midnight: "bg-[#131B3D] text-[#EDE6D6] border-[#D4B26A]/40 shadow-lg hover:border-[#D4B26A]",
  "bold-corporate": "bg-[#0E2A47] text-white border-[#0E2A47] hover:bg-[#0A2038]",
  "classic-ats": "bg-white text-[#22385C] border-[#B9BCC2] shadow-sm hover:border-[#22385C]",
  "design-folio":
    "bg-[#1a1a1a] text-[#CCFF00] border-[#333] shadow-lg font-mono hover:border-[#CCFF00]",
  "dev-terminal": "bg-[#2d333b] text-[#cdd9e5] border-[#444c56] shadow-lg hover:bg-[#373e47]",
} satisfies Record<SharePopoverVariant, string>;

export const sharePanelStyles = {
  "minimalist-editorial": "bg-white text-[#1B1B1F] border-[#E4E4E7]",
  "neo-brutalist": "bg-white text-black border-[3px] border-black shadow-[6px_6px_0_0_#000]",
  "glass-morphic": "bg-[#141A2E]/80 text-[#F4F6FB] border-white/15 backdrop-blur-xl",
  "bento-grid": "bg-[#F4D35E] text-[#1A1C20] border-[#1A1C20]/15",
  spotlight: "bg-[#E9E7F2] text-[#22163A] border-2 border-[#22163A]",
  midnight: "bg-[#0F1633]/95 text-[#EDE6D6] border-[#D4B26A]/30",
  "bold-corporate": "bg-white text-[#1B2430] border-[#0E2A47]/25",
  "classic-ats": "bg-white text-[#16181D] border-[#B9BCC2]",
  "design-folio": "bg-white text-black border-2 border-black",
  "dev-terminal": "bg-[#2d333b] text-[#adbac7] border-[#444c56]",
} satisfies Record<SharePopoverVariant, string>;

export const shareItemStyles = {
  "minimalist-editorial":
    "bg-white text-[#6B6B73] hover:text-[#1F5C4A] border border-[#E4E4E7] hover:border-[#1F5C4A]/40",
  "neo-brutalist": "bg-white text-black border-2 border-black font-bold hover:bg-[#FFD400]",
  "glass-morphic":
    "bg-white/[0.06] text-[#D7DCEC] hover:text-white hover:bg-white/[0.14] border border-white/15",
  "bento-grid": "bg-white/60 text-[#1A1C20] hover:bg-white border border-[#1A1C20]/10",
  spotlight:
    "bg-transparent text-[#22163A] hover:bg-[#FFD95A] border-2 border-[#22163A] rounded-full",
  midnight:
    "bg-[#131B3D] text-[#C9CEE4] hover:text-[#D4B26A] border border-[#D4B26A]/25 hover:border-[#D4B26A]/60",
  "bold-corporate": "bg-white text-[#0E2A47] hover:bg-[#EEF2F6] border-[#0E2A47]/25",
  "classic-ats": "bg-white text-[#3F434A] hover:text-[#22385C] border-[#B9BCC2]",
  "design-folio": "bg-white text-black hover:bg-[#2D3BFF] hover:text-white border-2 border-black",
  "dev-terminal":
    "bg-[#22272e] text-[#adbac7] hover:text-[#cdd9e5] hover:bg-[#373e47] border border-[#444c56]",
} satisfies Record<SharePopoverVariant, string>;
