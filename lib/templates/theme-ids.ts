import type { SharePopoverVariant } from "@/lib/templates/share-variants";

export const THEME_IDS = [
  "academic_cv",
  "bento",
  "blueprint",
  "boardroom",
  "bold_corporate",
  "broadsheet",
  "case_file",
  "classic_ats",
  "contact_sheet",
  "design_folio",
  "dev_terminal",
  "glass",
  "media_kit",
  "midnight",
  "minimalist_editorial",
  "neo_brutalist",
  "retro_os",
  "scrapbook",
  "spotlight",
  "workspace",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

/** Number of portfolio templates; use this instead of writing the count into copy. */
export const TEMPLATE_COUNT = THEME_IDS.length;

export const DEFAULT_THEME: ThemeId = "minimalist_editorial";

export function isValidThemeId(id: string): id is ThemeId {
  // SAFETY: ThemeId is a string union; widening THEME_IDS to readonly string[] is safe for includes check — runtime validation via isValidThemeId guarantees id is ThemeId when true.
  return (THEME_IDS as readonly string[]).includes(id);
}

/** URL slug for /templates/<slug>: the theme id in kebab case. */
export function themeSlug(id: ThemeId): string {
  return id.replaceAll("_", "-");
}

export function themeIdFromSlug(slug: string): ThemeId | null {
  const id = slug.replaceAll("-", "_");

  return isValidThemeId(id) ? id : null;
}

export const THEME_METADATA = {
  academic_cv: {
    name: "Academic CV",
    description:
      "A scholarly CV with education first, dated appointments and numbered research outputs",
    category: "Professional",
    preview: "/previews/academic-cv.webp",
  },
  bento: {
    name: "Bento Grid",
    description: "Flat colour tiles that fit together around your photo",
    category: "Modern",
    preview: "/previews/bento.webp",
  },
  blueprint: {
    name: "Blueprint",
    description: "A cyanotype drawing sheet with grid paper, section callouts and a title block",
    category: "Creative",
    preview: "/previews/blueprint.webp",
  },
  boardroom: {
    name: "Boardroom",
    description: "A dark executive ledger with a pinned identity column and brass accents",
    category: "Professional",
    preview: "/previews/boardroom.webp",
  },
  bold_corporate: {
    name: "Bold Corporate",
    description: "Annual-report layout with a navy sidebar and condensed headings",
    category: "Professional",
    preview: "/previews/bold-corporate.webp",
  },
  broadsheet: {
    name: "Broadsheet",
    description:
      "A newspaper front page: ruled columns, a masthead name and each role set as a story",
    category: "Professional",
    preview: "/previews/broadsheet.webp",
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
  contact_sheet: {
    name: "Contact Sheet",
    description:
      "Film-frame tiles on near-black with grease-pencil orange, built for photographers",
    category: "Creative",
    preview: "/previews/contact-sheet.webp",
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
  media_kit: {
    name: "Media Kit",
    description: "Bold colour blocks, a results wall and a by-the-numbers strip for marketers",
    category: "Modern",
    preview: "/previews/media-kit.webp",
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
  scrapbook: {
    name: "Scrapbook",
    description:
      "Craft-paper desk with taped index cards, sticky-note skills and a polaroid portrait",
    category: "Creative",
    preview: "/previews/scrapbook.webp",
  },
  spotlight: {
    name: "Spotlight",
    description: "Your name under a single pool of stage light, with work set out like a playbill.",
    category: "Creative",
    preview: "/previews/spotlight.webp",
  },
  workspace: {
    name: "Workspace",
    description: "A clean document page with a cover, a properties table and collapsible sections",
    category: "Modern",
    preview: "/previews/workspace.webp",
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
  boardroom: "boardroom",
  bold_corporate: "bold-corporate",
  classic_ats: "classic-ats",
  design_folio: "design-folio",
  dev_terminal: "dev-terminal",
  broadsheet: "broadsheet",
  case_file: "case-file",
  retro_os: "retro-os",
  academic_cv: "academic-cv",
  contact_sheet: "contact-sheet",
  workspace: "workspace",
  blueprint: "blueprint",
  scrapbook: "scrapbook",
  media_kit: "media-kit",
} as const satisfies Record<ThemeId, SharePopoverVariant>;
