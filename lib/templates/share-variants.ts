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

// eslint-disable-next-line anti-slop/require-safety-comment-for-type-assertion -- SHARE_VARIANT_KEYS is single source; Object.fromEntries builds exactly that union, cast safe
export const shareContainerStyles = Object.fromEntries(
  SHARE_VARIANT_KEYS.map((key) => [key, ""]),
) as Record<SharePopoverVariant, string>;

export const shareButtonStyles = {
  "minimalist-editorial":
    "text-neutral-500 hover:text-neutral-900 border border-neutral-200 rounded-full px-3 py-1.5 text-xs uppercase tracking-widest hover:bg-neutral-100",
  "neo-brutalist":
    "bg-white text-black border-2 border-black px-3 py-1.5 font-bold hover:bg-yellow-300 hover:translate-x-0.5 hover:-translate-y-0.5 shadow-[2px_2px_0_0_black] hover:shadow-[4px_4px_0_0_black]",
  "glass-morphic":
    "bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 hover:text-white hover:bg-white/20 rounded-lg px-3 py-1.5",
  "bento-grid":
    "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl px-3 py-1.5",
  spotlight:
    "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 rounded-lg px-3 py-1.5",
  midnight:
    "bg-amber-900/20 text-amber-200 hover:bg-amber-900/40 border border-amber-700/30 rounded-lg px-3 py-1.5",
  "bold-corporate":
    "bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200 rounded-md px-3 py-1.5 shadow-sm",
  "classic-ats":
    "text-gray-500 hover:text-gray-900 border border-gray-300 rounded px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-gray-100",
  "design-folio":
    "bg-[#1a1a1a] text-[#888] hover:text-[#CCFF00] border border-[#333] hover:border-[#CCFF00] rounded-full px-3 py-1.5 font-mono text-xs uppercase tracking-widest",
  "dev-terminal":
    "bg-[#161b22] text-[#c9d1d9] hover:text-[#58a6ff] border border-[#30363d] rounded px-3 py-1.5",
} satisfies Record<SharePopoverVariant, string>;

export const shareTriggerStyles = {
  "minimalist-editorial":
    "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900",
  "neo-brutalist":
    "bg-yellow-300 text-black border-2 border-black font-bold shadow-[4px_4px_0_0_black] hover:translate-x-0.5 hover:-translate-y-0.5",
  "glass-morphic": "bg-white/10 text-white/90 border-white/20 backdrop-blur-md hover:bg-white/20",
  "bento-grid":
    "bg-white text-neutral-700 border-neutral-200 shadow-sm dark:bg-neutral-900 dark:text-white dark:border-neutral-700",
  spotlight: "bg-orange-500 text-white border-orange-400 shadow-md",
  midnight: "bg-neutral-900 text-amber-200 border-amber-700/40 shadow-lg",
  "bold-corporate": "bg-white text-neutral-800 border-neutral-200 shadow-sm hover:bg-neutral-50",
  "classic-ats": "bg-white text-gray-700 border-gray-300 shadow-sm hover:bg-gray-50",
  "design-folio":
    "bg-[#1a1a1a] text-[#CCFF00] border-[#333] shadow-lg font-mono hover:border-[#CCFF00]",
  "dev-terminal":
    "bg-[#161b22] text-[#58a6ff] border-[#30363d] shadow-lg font-mono hover:border-[#58a6ff]",
} satisfies Record<SharePopoverVariant, string>;

export const sharePanelStyles = {
  "minimalist-editorial": "bg-white/95 text-neutral-800 border-neutral-200",
  "neo-brutalist": "bg-yellow-300 text-black border-2 border-black shadow-[4px_4px_0_0_black]",
  "glass-morphic": "bg-white/10 text-white border-white/20 backdrop-blur-xl",
  "bento-grid":
    "bg-white/95 text-neutral-800 border-neutral-200 dark:bg-neutral-900/95 dark:text-neutral-100 dark:border-neutral-700",
  spotlight: "bg-orange-50 text-orange-900 border-orange-200",
  midnight: "bg-neutral-900/95 text-amber-100 border-amber-700/30",
  "bold-corporate": "bg-white text-neutral-800 border-neutral-200",
  "classic-ats": "bg-white text-gray-700 border-gray-300",
  "design-folio": "bg-[#1a1a1a] text-[#e0e0e0] border-[#333]",
  "dev-terminal": "bg-[#161b22] text-[#c9d1d9] border-[#30363d]",
} satisfies Record<SharePopoverVariant, string>;

export const shareItemStyles = {
  "minimalist-editorial":
    "bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200 hover:bg-neutral-100",
  "neo-brutalist": "bg-white text-black border-2 border-black font-bold hover:bg-yellow-300",
  "glass-morphic":
    "bg-white/10 text-white/80 hover:text-white hover:bg-white/20 border border-white/20",
  "bento-grid":
    "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:border-neutral-700",
  spotlight: "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200",
  midnight: "bg-amber-900/20 text-amber-200 hover:bg-amber-900/40 border border-amber-700/30",
  "bold-corporate": "bg-white text-neutral-700 hover:bg-neutral-50 border-neutral-200",
  "classic-ats": "bg-white text-gray-600 hover:text-gray-900 border-gray-300",
  "design-folio":
    "bg-[#1a1a1a] text-[#888] hover:text-[#CCFF00] border border-[#333] font-mono hover:border-[#CCFF00]",
  "dev-terminal":
    "bg-[#161b22] text-[#c9d1d9] hover:text-[#58a6ff] border border-[#30363d] font-mono",
} satisfies Record<SharePopoverVariant, string>;
