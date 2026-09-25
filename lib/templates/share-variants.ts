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
    "bg-white text-black border-2 border-black px-3 py-1.5 font-bold hover:bg-yellow-300 hover:translate-x-0.5 hover:-translate-y-0.5 shadow-[2px_2px_0_0_black] hover:shadow-[4px_4px_0_0_black]",
  "glass-morphic":
    "bg-white/[0.07] backdrop-blur-md border border-white/15 text-[#D7DCEC] hover:text-white hover:bg-white/[0.14] rounded-full px-3.5 py-1.5",
  "bento-grid":
    "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl px-3 py-1.5",
  spotlight:
    "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 rounded-lg px-3 py-1.5",
  midnight:
    "bg-transparent text-[#C9CEE4] hover:text-[#D4B26A] border border-[#D4B26A]/30 hover:border-[#D4B26A]/70 rounded-full px-3.5 py-1.5",
  "bold-corporate":
    "bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200 rounded-md px-3 py-1.5 shadow-sm",
  "classic-ats":
    "bg-white text-[#3F434A] hover:text-[#22385C] border border-[#B9BCC2] rounded-[3px] px-3 py-1.5 text-sm hover:border-[#22385C]",
  "design-folio":
    "bg-[#1a1a1a] text-[#888] hover:text-[#CCFF00] border border-[#333] hover:border-[#CCFF00] rounded-full px-3 py-1.5 font-mono text-xs uppercase tracking-widest",
  "dev-terminal":
    "bg-[#2d333b] text-[#adbac7] hover:text-[#cdd9e5] hover:bg-[#373e47] border border-[#444c56] rounded-md px-3 py-1.5",
} satisfies Record<SharePopoverVariant, string>;

export const shareTriggerStyles = {
  "minimalist-editorial":
    "bg-white text-[#1B1B1F] border-[#E4E4E7] hover:text-[#1F5C4A] hover:border-[#1F5C4A]/40",
  "neo-brutalist":
    "bg-yellow-300 text-black border-2 border-black font-bold shadow-[4px_4px_0_0_black] hover:translate-x-0.5 hover:-translate-y-0.5",
  "glass-morphic":
    "bg-white/[0.08] text-[#F4F6FB] border-white/20 backdrop-blur-md hover:bg-white/[0.16] rounded-full",
  "bento-grid":
    "bg-white text-neutral-700 border-neutral-200 shadow-sm dark:bg-neutral-900 dark:text-white dark:border-neutral-700",
  spotlight: "bg-orange-500 text-white border-orange-400 shadow-md",
  midnight: "bg-[#131B3D] text-[#EDE6D6] border-[#D4B26A]/40 shadow-lg hover:border-[#D4B26A]",
  "bold-corporate": "bg-white text-neutral-800 border-neutral-200 shadow-sm hover:bg-neutral-50",
  "classic-ats": "bg-white text-[#22385C] border-[#B9BCC2] shadow-sm hover:border-[#22385C]",
  "design-folio":
    "bg-[#1a1a1a] text-[#CCFF00] border-[#333] shadow-lg font-mono hover:border-[#CCFF00]",
  "dev-terminal": "bg-[#2d333b] text-[#cdd9e5] border-[#444c56] shadow-lg hover:bg-[#373e47]",
} satisfies Record<SharePopoverVariant, string>;

export const sharePanelStyles = {
  "minimalist-editorial": "bg-white text-[#1B1B1F] border-[#E4E4E7]",
  "neo-brutalist": "bg-yellow-300 text-black border-2 border-black shadow-[4px_4px_0_0_black]",
  "glass-morphic": "bg-[#141A2E]/80 text-[#F4F6FB] border-white/15 backdrop-blur-xl",
  "bento-grid":
    "bg-white/95 text-neutral-800 border-neutral-200 dark:bg-neutral-900/95 dark:text-neutral-100 dark:border-neutral-700",
  spotlight: "bg-orange-50 text-orange-900 border-orange-200",
  midnight: "bg-[#0F1633]/95 text-[#EDE6D6] border-[#D4B26A]/30",
  "bold-corporate": "bg-white text-neutral-800 border-neutral-200",
  "classic-ats": "bg-white text-[#16181D] border-[#B9BCC2]",
  "design-folio": "bg-[#1a1a1a] text-[#e0e0e0] border-[#333]",
  "dev-terminal": "bg-[#2d333b] text-[#adbac7] border-[#444c56]",
} satisfies Record<SharePopoverVariant, string>;

export const shareItemStyles = {
  "minimalist-editorial":
    "bg-white text-[#6B6B73] hover:text-[#1F5C4A] border border-[#E4E4E7] hover:border-[#1F5C4A]/40",
  "neo-brutalist": "bg-white text-black border-2 border-black font-bold hover:bg-yellow-300",
  "glass-morphic":
    "bg-white/[0.06] text-[#D7DCEC] hover:text-white hover:bg-white/[0.14] border border-white/15",
  "bento-grid":
    "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:border-neutral-700",
  spotlight: "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200",
  midnight:
    "bg-[#131B3D] text-[#C9CEE4] hover:text-[#D4B26A] border border-[#D4B26A]/25 hover:border-[#D4B26A]/60",
  "bold-corporate": "bg-white text-neutral-700 hover:bg-neutral-50 border-neutral-200",
  "classic-ats": "bg-white text-[#3F434A] hover:text-[#22385C] border-[#B9BCC2]",
  "design-folio":
    "bg-[#1a1a1a] text-[#888] hover:text-[#CCFF00] border border-[#333] font-mono hover:border-[#CCFF00]",
  "dev-terminal":
    "bg-[#22272e] text-[#adbac7] hover:text-[#cdd9e5] hover:bg-[#373e47] border border-[#444c56]",
} satisfies Record<SharePopoverVariant, string>;
