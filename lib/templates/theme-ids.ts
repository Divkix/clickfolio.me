/**
 * Pure data module for theme IDs, metadata, and type guards.
 * ZERO component imports — safe for API routes, client components, and anywhere
 * that should not pull in template component bundles.
 */

export const THEME_IDS = [
  "bento",
  "bold_corporate",
  "glass",
  "midnight",
  "minimalist_editorial",
  "neo_brutalist",
  "spotlight",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "minimalist_editorial";

/**
 * Type guard to check if a string is a valid ThemeId
 */
export function isValidThemeId(id: string): id is ThemeId {
  return (THEME_IDS as readonly string[]).includes(id);
}

/**
 * Theme metadata for UI display
 * referralsRequired: 0 = free, >0 = requires N referrals to unlock
 */
export const THEME_METADATA: Record<
  ThemeId,
  {
    readonly name: string;
    readonly description: string;
    readonly category: string;
    readonly preview: string;
    readonly referralsRequired: number;
  }
> = {
  bento: {
    name: "Bento Grid",
    description: "Modern mosaic layout with colorful cards",
    category: "Modern",
    preview: "/previews/bento.png",
    referralsRequired: 0, // Free
  },
  bold_corporate: {
    name: "Bold Corporate",
    description: "Executive typography with bold numbered sections",
    category: "Professional",
    preview: "/previews/bold-corporate.png",
    referralsRequired: 10, // Premium - 10 referrals
  },
  glass: {
    name: "Glass Morphic",
    description: "Dark theme with frosted glass effects",
    category: "Modern",
    preview: "/previews/glass.png",
    referralsRequired: 0, // Free
  },
  midnight: {
    name: "Midnight",
    description: "Dark minimal with serif headings and gold accents",
    category: "Modern",
    preview: "/previews/midnight.png",
    referralsRequired: 5, // Premium - 5 referrals
  },
  minimalist_editorial: {
    name: "Minimalist Editorial",
    description: "Clean magazine-style layout with serif typography",
    category: "Professional",
    preview: "/previews/minimalist.png",
    referralsRequired: 0, // Free (default)
  },
  neo_brutalist: {
    name: "Neo Brutalist",
    description: "Bold design with thick borders and loud colors",
    category: "Creative",
    preview: "/previews/brutalist.png",
    referralsRequired: 0, // Free
  },
  spotlight: {
    name: "Spotlight",
    description: "Warm creative portfolio with animated sections",
    category: "Creative",
    preview: "/previews/spotlight.png",
    referralsRequired: 3, // Premium - 3 referrals
  },
} as const;

/**
 * Check if a theme is unlocked for a user based on their referral count
 * @param themeId - The theme ID to check
 * @param referralCount - User's current referral count
 * @param isPro - Whether user has pro status (unlocks all themes)
 */
export function isThemeUnlocked(themeId: ThemeId, referralCount: number, isPro = false): boolean {
  if (isPro) return true;
  const metadata = THEME_METADATA[themeId];
  return referralCount >= metadata.referralsRequired;
}

/**
 * Get the referral requirement for a theme
 */
export function getThemeReferralRequirement(themeId: ThemeId): number {
  return THEME_METADATA[themeId].referralsRequired;
}

/**
 * Get all unlocked themes for a user
 * @param referralCount - User's current referral count
 * @param isPro - Whether user has pro status (unlocks all themes)
 */
export function getUnlockedThemes(referralCount: number, isPro = false): ThemeId[] {
  return THEME_IDS.filter((id) => isThemeUnlocked(id, referralCount, isPro));
}
