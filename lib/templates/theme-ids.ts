import type { SharePopoverVariant } from "@/lib/templates/share-variants";

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

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "minimalist_editorial";

export function isValidThemeId(id: string): id is ThemeId {
  // SAFETY: ThemeId is a string union; widening THEME_IDS to readonly string[] is safe for includes check — runtime validation via isValidThemeId guarantees id is ThemeId when true.
  return (THEME_IDS as readonly string[]).includes(id);
}

export const THEME_METADATA = {
  bento: {
    name: "Bento Grid",
    description: "Modern mosaic layout with colorful cards",
    category: "Modern",
    preview: "/previews/bento.webp",
  },
  bold_corporate: {
    name: "Bold Corporate",
    description: "Executive typography with bold numbered sections",
    category: "Professional",
    preview: "/previews/bold-corporate.webp",
  },
  classic_ats: {
    name: "Classic ATS",
    description: "Legal brief typography, single-column ATS-optimized layout",
    category: "Professional",
    preview: "/previews/classic-ats.webp",
  },
  design_folio: {
    name: "DesignFolio",
    description: "Dark Swiss editorial with acid lime accents and a frosted nav.",
    category: "Creative",
    preview: "/previews/design-folio.webp",
  },
  dev_terminal: {
    name: "DevTerminal",
    description: "GitHub-inspired dark terminal aesthetic for developers",
    category: "Developer",
    preview: "/previews/dev-terminal.webp",
  },
  glass: {
    name: "Glass Morphic",
    description: "Dark theme with frosted glass effects",
    category: "Modern",
    preview: "/previews/glass.webp",
  },
  midnight: {
    name: "Midnight",
    description: "Dark minimal with serif headings and gold accents",
    category: "Modern",
    preview: "/previews/midnight.webp",
  },
  minimalist_editorial: {
    name: "Minimalist Editorial",
    description: "Clean magazine-style layout with serif typography",
    category: "Professional",
    preview: "/previews/minimalist.webp",
  },
  neo_brutalist: {
    name: "Neo Brutalist",
    description: "Loud poster layout with thick borders and high-contrast type",
    category: "Creative",
    preview: "/previews/brutalist.webp",
  },
  spotlight: {
    name: "Spotlight",
    description: "Warm creative portfolio with animated sections",
    category: "Creative",
    preview: "/previews/spotlight.webp",
  },
} as const satisfies Record<
  ThemeId,
  {
    readonly name: string;
    readonly description: string;
    readonly category: string;
    readonly preview: string;
  }
>;

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
