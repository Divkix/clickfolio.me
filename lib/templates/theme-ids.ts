/**
 * Adding a theme, in order: this list → `THEME_METADATA` (below) → `THEME_CHROME` (theme-chrome.ts:
 * CTA, attribution, share and preview classes) → `TEMPLATE_LOADERS` (theme-registry.tsx) → resume
 * demo data (demo-data.ts) and gallery profiles (demo-profiles.ts) → landing copy in theme-pages.ts
 * (`/templates/<kebab>`) → a route key in lib/seo/lastmod.json → `public/previews/<kebab>.webp`
 * (1280×800@2x of `/preview/<id>` after fonts load, sharp webp q82) plus its 640/960/1280w copies
 * (`pnpm exec tsx scripts/generate-preview-variants.ts`). `Record<ThemeId, …>` types catch missing
 * table entries, theme-ids.test.ts a missing preview; templates-render.test.ts renders every theme.
 * Recommend it for roles via `PROFESSIONS[].themes` (lib/config/professions.ts).
 *
 * Removing one: undo that chain, map the id in `REMOVED_THEME_REPLACEMENTS`, and ship a custom data
 * migration (`drizzle-kit generate --custom`) remapping `site_data.theme_id`, like
 * migrations_pg/0011_remap_removed_themes.sql.
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
    description: "Education first, with dated work history and a numbered list of research",
    category: "Professional",
    preview: "/previews/academic-cv.webp",
  },
  bento: {
    name: "Bento Grid",
    description: "Colourful cards for your current role, key results and work history",
    category: "Modern",
    preview: "/previews/bento.webp",
  },
  blueprint: {
    name: "Blueprint",
    description: "A blue grid background with clearly labelled sections",
    category: "Creative",
    preview: "/previews/blueprint.webp",
  },
  boardroom: {
    name: "Boardroom",
    description: "A dark two-column layout with your details on the left and gold highlights",
    category: "Professional",
    preview: "/previews/boardroom.webp",
  },
  bold_corporate: {
    name: "Bold Corporate",
    description: "A dark blue side panel with bold headings and a clear work history",
    category: "Professional",
    preview: "/previews/bold-corporate.webp",
  },
  broadsheet: {
    name: "Broadsheet",
    description: "Newspaper-style columns with a large name heading and a story for each role",
    category: "Professional",
    preview: "/previews/broadsheet.webp",
  },
  case_file: {
    name: "Case File",
    description: "A paper-folder design with typed text and clearly labelled sections",
    category: "Professional",
    preview: "/previews/case-file.webp",
  },
  classic_ats: {
    name: "Classic ATS",
    description: "A simple one-column resume that is easy to print and read",
    category: "Professional",
    preview: "/previews/classic-ats.webp",
  },
  contact_sheet: {
    name: "Contact Sheet",
    description: "A dark photo grid with orange highlights for photographers",
    category: "Creative",
    preview: "/previews/contact-sheet.webp",
  },
  design_folio: {
    name: "DesignFolio",
    description: "A grey grid with a bright blue name panel and large project images",
    category: "Creative",
    preview: "/previews/design-folio.webp",
  },
  dev_terminal: {
    name: "DevTerminal",
    description: "A developer profile with featured projects and a timeline of your work",
    category: "Developer",
    preview: "/previews/dev-terminal.webp",
  },
  gallery_wall: {
    name: "Gallery Wall",
    description: "Large images with short labels and your work history below",
    category: "Creative",
    preview: "/previews/gallery-wall.webp",
  },
  glass: {
    name: "Glass Morphic",
    description: "Soft colours and see-through panels with a frosted-glass look",
    category: "Modern",
    preview: "/previews/glass.webp",
  },
  lesson_plan: {
    name: "Lesson Plan",
    description: "A lined planner page with coloured tabs and a sticky note",
    category: "Creative",
    preview: "/previews/lesson-plan.webp",
  },
  liner_notes: {
    name: "Liner Notes",
    description: "A record-cover design with your jobs listed like songs on an album",
    category: "Creative",
    preview: "/previews/liner-notes.webp",
  },
  link_stack: {
    name: "Link Stack",
    description: "Full-width coloured bars that open your links and work history",
    category: "Modern",
    preview: "/previews/link-stack.webp",
  },
  manuscript: {
    name: "Manuscript",
    description: "A book-style layout with a title page and a table of contents",
    category: "Professional",
    preview: "/previews/manuscript.webp",
  },
  media_kit: {
    name: "Media Kit",
    description: "A bright pink cover with the brands you have worked with and your results",
    category: "Modern",
    preview: "/previews/media-kit.webp",
  },
  midnight: {
    name: "Midnight",
    description: "A dark blue background, classic headings and a gold timeline",
    category: "Modern",
    preview: "/previews/midnight.webp",
  },
  minimalist_editorial: {
    name: "Minimalist Editorial",
    description: "A simple single column with classic text and dates along the side",
    category: "Professional",
    preview: "/previews/minimalist.webp",
  },
  neo_brutalist: {
    name: "Neo Brutalist",
    description: "A bright yellow poster with a large name and scrolling skills",
    category: "Creative",
    preview: "/previews/brutalist.webp",
  },
  open_house: {
    name: "Open House",
    description: "A house-listing design with a hanging name sign and a card for each role",
    category: "Creative",
    preview: "/previews/open-house.webp",
  },
  personal_best: {
    name: "Personal Best",
    description: "A running-track design with your results on a scoreboard",
    category: "Modern",
    preview: "/previews/personal-best.webp",
  },
  pitch_deck: {
    name: "Pitch Deck",
    description: "A slide-style layout with a large introduction and key results",
    category: "Modern",
    preview: "/previews/pitch-deck.webp",
  },
  quota: {
    name: "Quota",
    description: "A sales resume with your key results and a timeline of your work",
    category: "Professional",
    preview: "/previews/quota.webp",
  },
  reel: {
    name: "Reel",
    description: "A video-editing design with your work arranged along a timeline",
    category: "Creative",
    preview: "/previews/reel.webp",
  },
  retro_os: {
    name: "Retro OS",
    description: "An old-style computer desktop with a separate window for each section",
    category: "Creative",
    preview: "/previews/retro-os.webp",
  },
  rounds: {
    name: "Rounds",
    description: "A nurse's ID-card design with licenses first and a clear work history",
    category: "Professional",
    preview: "/previews/rounds.webp",
  },
  scrapbook: {
    name: "Scrapbook",
    description: "A paper scrapbook with taped cards, sticky notes and a photo",
    category: "Creative",
    preview: "/previews/scrapbook.webp",
  },
  spotlight: {
    name: "Spotlight",
    description: "A dark stage with a spotlight on your name and a list of your work",
    category: "Creative",
    preview: "/previews/spotlight.webp",
  },
  the_brief: {
    name: "The Brief",
    description: "A formal document with numbered sections and easy-to-read paragraphs",
    category: "Professional",
    preview: "/previews/the-brief.webp",
  },
  the_menu: {
    name: "The Menu",
    description: "A restaurant-menu design with a checked background and years beside each role",
    category: "Creative",
    preview: "/previews/the-menu.webp",
  },
  workspace: {
    name: "Workspace",
    description: "A clean document page with a cover and sections you can open or close",
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
