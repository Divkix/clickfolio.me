/**
 * Theme maintenance beyond completeness checks: curate demo-data.ts content, add a lightweight
 * demo-profiles.ts gallery profile, write theme-pages.ts landing copy, recommend suitable roles
 * through PROFESSIONS[].themes, and update lib/seo/lastmod.json.
 * Capture public/previews/<kebab>.webp from /preview/<id> after Google Fonts load; use sharp
 * encoding consistent with scripts/generate-preview-variants.ts, then run that script for variants.
 * Record<ThemeId, ...> checks complete tables; theme-ids.test.ts checks preview variant files
 * and replacement resolution; templates-render.test.ts exercises every theme across resume shapes.
 * Review demo/copy quality and the original preview visually; those checks cannot judge it.
 * Removal also needs REMOVED_THEME_REPLACEMENTS and a custom Drizzle data migration remapping
 * site_data.theme_id (see migrations_pg/0011_remap_removed_themes.sql), not just registry deletion.
 * Read stored ids through resolveThemeId; use TEMPLATE_COUNT rather than counts in copy.
 */
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
  "gallery_wall",
  "glass",
  "lesson_plan",
  "liner_notes",
  "link_stack",
  "manuscript",
  "media_kit",
  "midnight",
  "minimalist_editorial",
  "neo_brutalist",
  "open_house",
  "personal_best",
  "pitch_deck",
  "quota",
  "reel",
  "retro_os",
  "rounds",
  "scrapbook",
  "spotlight",
  "the_brief",
  "the_menu",
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

/**
 * Theme ids that were removed from THEME_IDS, mapped to the theme their users moved to. Stored
 * rows are remapped by a data migration; this keeps reads and old /templates/<slug> links working.
 */
export const REMOVED_THEME_REPLACEMENTS = {
  consulting_brief: "classic_ats",
  dashboard: "workspace",
  infographic: "bento",
  networked: "bold_corporate",
  noir: "midnight",
  sidebar_photo: "bold_corporate",
  timeline: "minimalist_editorial",
} as const satisfies Record<string, ThemeId>;

const REMOVED_THEME_LOOKUP = new Map(Object.entries<ThemeId>(REMOVED_THEME_REPLACEMENTS));

/** The theme that replaced a removed theme id, or null when `id` was never removed. */
export function replacementForRemovedTheme(id: string): ThemeId | null {
  return REMOVED_THEME_LOOKUP.get(id) ?? null;
}

/** Any stored theme id → a renderable theme: valid ids pass, removed ids map, the rest default. */
export function resolveThemeId(raw: string | null | undefined): ThemeId {
  if (!raw) return DEFAULT_THEME;

  if (isValidThemeId(raw)) return raw;

  return replacementForRemovedTheme(raw) ?? DEFAULT_THEME;
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
    description: "Flat colour tiles for your current role, a standout result and your full career",
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
  gallery_wall: {
    name: "Gallery Wall",
    description: "An exhibition wall with hung works on labels and a printed artist CV below",
    category: "Creative",
    preview: "/previews/gallery-wall.webp",
  },
  glass: {
    name: "Glass Morphic",
    description: "Frosted glass panes lit by one window of light, with a reeded-glass insert",
    category: "Modern",
    preview: "/previews/glass.webp",
  },
  lesson_plan: {
    name: "Lesson Plan",
    description: "A ruled planner page with binder holes, coloured subject tabs and a sticky note",
    category: "Creative",
    preview: "/previews/lesson-plan.webp",
  },
  liner_notes: {
    name: "Liner Notes",
    description:
      "An album sleeve with the record sliding out and your jobs listed as Side A tracks",
    category: "Creative",
    preview: "/previews/liner-notes.webp",
  },
  link_stack: {
    name: "Link Stack",
    description:
      "A link-in-bio page of full-width colour bars, ultramarine to peach, each one a link to tap or a role to open",
    category: "Modern",
    preview: "/previews/link-stack.webp",
  },
  manuscript: {
    name: "Manuscript",
    description:
      "A book spread with a title page, a table of contents and bylines as a bibliography",
    category: "Professional",
    preview: "/previews/manuscript.webp",
  },
  media_kit: {
    name: "Media Kit",
    description:
      "A creator's brand one-sheet: a fuchsia cover, a wordmark wall of who you've worked with and your real results",
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
  open_house: {
    name: "Open House",
    description:
      "A real-estate listing sheet: your name on a hanging yard sign, a property-details table and roles filed as listings",
    category: "Creative",
    preview: "/previews/open-house.webp",
  },
  personal_best: {
    name: "Personal Best",
    description:
      "A track meet: your name painted across the lanes, real marks on an LED board and roles as a results sheet",
    category: "Modern",
    preview: "/previews/personal-best.webp",
  },
  pitch_deck: {
    name: "Pitch Deck",
    description: "Your resume as a 16:9 founder deck: title slide, one-liner, traction and the ask",
    category: "Modern",
    preview: "/previews/pitch-deck.webp",
  },
  quota: {
    name: "Quota",
    description:
      "A sales resume with a closed-won board of the real figures from your highlights and a dated track record",
    category: "Professional",
    preview: "/previews/quota.webp",
  },
  reel: {
    name: "Reel",
    description: "A film-editing timeline with clip markers, timecode dates and a red playhead",
    category: "Creative",
    preview: "/previews/reel.webp",
  },
  retro_os: {
    name: "Retro OS",
    description: "A late-90s desktop where every section opens in its own bevelled window",
    category: "Creative",
    preview: "/previews/retro-os.webp",
  },
  rounds: {
    name: "Rounds",
    description:
      "A nurse's ID badge on a lanyard, with licenses first and experience as a shift log",
    category: "Professional",
    preview: "/previews/rounds.webp",
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
    description:
      "A dark stage with a hard-edged followspot on your name and a theatre programme of credits",
    category: "Creative",
    preview: "/previews/spotlight.webp",
  },
  the_brief: {
    name: "The Brief",
    description:
      "A legal brief: a boxed caption header, roman-numeral sections and double-spaced serif paragraphs",
    category: "Professional",
    preview: "/previews/the-brief.webp",
  },
  the_menu: {
    name: "The Menu",
    description:
      "A bistro prix-fixe card on a gingham tablecloth, with roles priced in years along dotted leaders",
    category: "Creative",
    preview: "/previews/the-menu.webp",
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

/** Widths of the downscaled preview copies (`scripts/generate-preview-variants.ts`). */
export const PREVIEW_WIDTHS = [640, 960, 1280] as const;

/** `srcSet` for a 2560w theme preview: its downscaled copies plus the original. */
export function previewSrcSet(preview: string): string {
  const base = preview.replace(/\.webp$/, "");

  return [...PREVIEW_WIDTHS.map((w) => `${base}-${w}w.webp ${w}w`), `${preview} 2560w`].join(", ");
}
