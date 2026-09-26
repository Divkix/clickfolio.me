import type { SharePopoverVariant } from "@/lib/templates/share-variants";

export const THEME_IDS = [
  "bento",
  "bold_corporate",
  "case_file",
  "classic_ats",
  "design_folio",
  "dev_terminal",
  "glass",
  "midnight",
  "minimalist_editorial",
  "neo_brutalist",
  "retro_os",
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
    description: "Flat colour tiles that fit together around your photo",
    category: "Modern",
    preview: "/previews/bento.webp",
  },
  bold_corporate: {
    name: "Bold Corporate",
    description: "Annual-report layout with a navy sidebar and condensed headings",
    category: "Professional",
    preview: "/previews/bold-corporate.webp",
  },
  case_file: {
    name: "Case File",
    description:
      "A typed dossier in a manila folder, with each section filed as a lettered exhibit",
    category: "Professional",
    preview: "/previews/case-file.webp",
  },
  classic_ats: {
    name: "Classic ATS",
    description:
      "A printable one-column resume sheet that applicant tracking systems parse cleanly",
    category: "Professional",
    preview: "/previews/classic-ats.webp",
  },
  design_folio: {
    name: "DesignFolio",
    description: "Swiss grid on cool grey with a cobalt name block. Project images lead the page.",
    category: "Creative",
    preview: "/previews/design-folio.webp",
  },
  dev_terminal: {
    name: "DevTerminal",
    description: "GitHub-style profile with pinned projects and a commit timeline",
    category: "Developer",
    preview: "/previews/dev-terminal.webp",
  },
  glass: {
    name: "Glass Morphic",
    description: "Frosted glass panels over a deep indigo aurora",
    category: "Modern",
    preview: "/previews/glass.webp",
  },
  midnight: {
    name: "Midnight",
    description: "Midnight blue night sky, Garamond headings and a gold star timeline",
    category: "Modern",
    preview: "/previews/midnight.webp",
  },
  minimalist_editorial: {
    name: "Minimalist Editorial",
    description: "Quiet single serif column with dates set in the margin",
    category: "Professional",
    preview: "/previews/minimalist.webp",
  },
  neo_brutalist: {
    name: "Neo Brutalist",
    description: "Loud yellow poster with a giant name, hard shadows and a skills ticker",
    category: "Creative",
    preview: "/previews/brutalist.webp",
  },
  retro_os: {
    name: "Retro OS",
    description: "A late-90s desktop where every section opens in its own bevelled window",
    category: "Creative",
    preview: "/previews/retro-os.webp",
  },
  spotlight: {
    name: "Spotlight",
    description: "Your name under a single pool of stage light, with work set out like a playbill.",
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
  case_file: "case-file",
  retro_os: "retro-os",
} as const satisfies Record<ThemeId, SharePopoverVariant>;
