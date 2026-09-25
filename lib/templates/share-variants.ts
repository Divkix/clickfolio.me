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
    "bg-amber-900/20 text-amber-200 hover:bg-amber-900/40 border border-amber-700/30 rounded-lg px-3 py-1.5",
  "bold-corporate":
    "bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200 rounded-md px-3 py-1.5 shadow-sm",
  "classic-ats":
    "bg-white text-[#3F434A] hover:text-[#22385C] border border-[#B9BCC2] rounded-[3px] px-3 py-1.5 text-sm hover:border-[#22385C]",
  "design-folio":
    "bg-[#1a1a1a] text-[#888] hover:text-[#CCFF00] border border-[#333] hover:border-[#CCFF00] rounded-full px-3 py-1.5 font-mono text-xs uppercase tracking-widest",
  "dev-terminal":
    "bg-[#161b22] text-[#c9d1d9] hover:text-[#58a6ff] border border-[#30363d] rounded px-3 py-1.5",
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
  midnight: "bg-neutral-900 text-amber-200 border-amber-700/40 shadow-lg",
  "bold-corporate": "bg-white text-neutral-800 border-neutral-200 shadow-sm hover:bg-neutral-50",
  "classic-ats": "bg-white text-[#22385C] border-[#B9BCC2] shadow-sm hover:border-[#22385C]",
  "design-folio":
    "bg-[#1a1a1a] text-[#CCFF00] border-[#333] shadow-lg font-mono hover:border-[#CCFF00]",
  "dev-terminal":
    "bg-[#161b22] text-[#58a6ff] border-[#30363d] shadow-lg font-mono hover:border-[#58a6ff]",
} satisfies Record<SharePopoverVariant, string>;

export const sharePanelStyles = {
  "minimalist-editorial": "bg-white text-[#1B1B1F] border-[#E4E4E7]",
  "neo-brutalist": "bg-yellow-300 text-black border-2 border-black shadow-[4px_4px_0_0_black]",
  "glass-morphic": "bg-[#141A2E]/80 text-[#F4F6FB] border-white/15 backdrop-blur-xl",
  "bento-grid":
    "bg-white/95 text-neutral-800 border-neutral-200 dark:bg-neutral-900/95 dark:text-neutral-100 dark:border-neutral-700",
  spotlight: "bg-orange-50 text-orange-900 border-orange-200",
  midnight: "bg-neutral-900/95 text-amber-100 border-amber-700/30",
  "bold-corporate": "bg-white text-neutral-800 border-neutral-200",
  "classic-ats": "bg-white text-[#16181D] border-[#B9BCC2]",
  "design-folio": "bg-[#1a1a1a] text-[#e0e0e0] border-[#333]",
  "dev-terminal": "bg-[#161b22] text-[#c9d1d9] border-[#30363d]",
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
  midnight: "bg-amber-900/20 text-amber-200 hover:bg-amber-900/40 border border-amber-700/30",
  "bold-corporate": "bg-white text-neutral-700 hover:bg-neutral-50 border-neutral-200",
  "classic-ats": "bg-white text-[#3F434A] hover:text-[#22385C] border-[#B9BCC2]",
  "design-folio":
    "bg-[#1a1a1a] text-[#888] hover:text-[#CCFF00] border border-[#333] font-mono hover:border-[#CCFF00]",
  "dev-terminal":
    "bg-[#161b22] text-[#c9d1d9] hover:text-[#58a6ff] border border-[#30363d] font-mono",
} satisfies Record<SharePopoverVariant, string>;
