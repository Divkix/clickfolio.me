/**
 * Pure data module for theme IDs, metadata, and type guards.
 *
 * ZERO component imports — safe for API routes, client components, and anywhere
 * that should not pull in template component bundles.
 *
 * Type imports from components are fine — they're erased at compile time
 * and do not pull component bundles into server routes.
 */

import type { SharePopoverVariant } from "@/components/SharePopover";

/** Registry of all available theme IDs. */
export const THEME_IDS = [
  "bento",
  "bold_corporate",
  "classic_ats",
  "design_folio",
  "dev_terminal",
  "glass",
  "midnight",
  "minimalist_editorial",
  "neo_brutalist",
  "spotlight",
] as const;

/** Union type of all valid theme IDs. */
export type ThemeId = (typeof THEME_IDS)[number];

/** Default theme ID used when none is selected or an invalid ID is provided. */
export const DEFAULT_THEME: ThemeId = "minimalist_editorial";

/**
 * Type guard to check if a string is a valid ThemeId
 */
export function isValidThemeId(id: string): id is ThemeId {
  // SAFETY: ThemeId is a string union; widening THEME_IDS to readonly string[] is safe for includes check — runtime validation via isValidThemeId guarantees id is ThemeId when true.
  return (THEME_IDS as readonly string[]).includes(id);
}

/**
 * Theme metadata for UI display
 * All themes are free; referralsRequired is retained at 0 for compatibility.
 */
export const THEME_METADATA = {
  bento: {
    name: "Bento Grid",
    description: "Modern mosaic layout with colorful cards",
    category: "Modern",
    preview: "/previews/bento.webp",
    referralsRequired: 0, // Free
  },
  bold_corporate: {
    name: "Bold Corporate",
    description: "Executive typography with bold numbered sections",
    category: "Professional",
    preview: "/previews/bold-corporate.webp",
    referralsRequired: 0, // Free
  },
  classic_ats: {
    name: "Classic ATS",
    description: "Legal brief typography, single-column ATS-optimized layout",
    category: "Professional",
    preview: "/previews/classic-ats.webp",
    referralsRequired: 0, // Free
  },
  design_folio: {
    name: "DesignFolio",
    description: "Digital brutalism meets Swiss typography. Dark theme with acid lime accents.",
    category: "Creative",
    preview: "/previews/design-folio.webp",
    referralsRequired: 0, // Free
  },
  dev_terminal: {
    name: "DevTerminal",
    description: "GitHub-inspired dark terminal aesthetic for developers",
    category: "Developer",
    preview: "/previews/dev-terminal.webp",
    referralsRequired: 0, // Free
  },
  glass: {
    name: "Glass Morphic",
    description: "Dark theme with frosted glass effects",
    category: "Modern",
    preview: "/previews/glass.webp",
    referralsRequired: 0, // Free
  },
  midnight: {
    name: "Midnight",
    description: "Dark minimal with serif headings and gold accents",
    category: "Modern",
    preview: "/previews/midnight.webp",
    referralsRequired: 0, // Free
  },
  minimalist_editorial: {
    name: "Minimalist Editorial",
    description: "Clean magazine-style layout with serif typography",
    category: "Professional",
    preview: "/previews/minimalist.webp",
    referralsRequired: 0, // Free (default)
  },
  neo_brutalist: {
    name: "Neo Brutalist",
    description: "Bold design with thick borders and loud colors",
    category: "Creative",
    preview: "/previews/brutalist.webp",
    referralsRequired: 0, // Free
  },
  spotlight: {
    name: "Spotlight",
    description: "Warm creative portfolio with animated sections",
    category: "Creative",
    preview: "/previews/spotlight.webp",
    referralsRequired: 0, // Free
  },
} as const satisfies Record<
  ThemeId,
  {
    readonly name: string;
    readonly description: string;
    readonly category: string;
    readonly preview: string;
    readonly referralsRequired: number;
  }
>;

/**
 * Check if a theme is unlocked for a user.
 * All themes are free, so this always returns true. Extra parameters are
 * accepted for backward compatibility and ignored.
 */
export function isThemeUnlocked(
  _themeId: ThemeId,
  _referralCount?: number,
  _isPro?: boolean,
): boolean {
  return true;
}

/**
 * Get the referral requirement for a theme. Always 0 since all themes are free.
 */
export function getThemeReferralRequirement(_themeId: ThemeId): number {
  return 0;
}

/**
 * Map database theme IDs (underscore) to share popover variants (kebab-case).
 */
export const themeToShareVariant = {
  minimalist_editorial: "minimalist-editorial",
  neo_brutalist: "neo-brutalist",
  glass: "glass-morphic",
  bento: "bento-grid",
  spotlight: "spotlight",
  midnight: "midnight",
  bold_corporate: "bold-corporate",
  classic_ats: "classic-ats",
  design_folio: "design-folio",
  dev_terminal: "dev-terminal",
} as const satisfies Record<ThemeId, SharePopoverVariant>;
