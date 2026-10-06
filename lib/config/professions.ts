import type { ThemeId } from "@/lib/templates/theme-ids";

export interface Profession {
  slug: string;
  label: string;
  /** Themes recommended on /for/<slug>; /templates/<theme> links back to these professions. */
  themes: readonly ThemeId[];
}

export const PROFESSIONS: readonly Profession[] = [
  {
    slug: "software-engineer",
    label: "Software Engineers",
    themes: ["dev_terminal", "minimalist_editorial", "glass"],
  },
  { slug: "designer", label: "Designers", themes: ["design_folio", "neo_brutalist", "spotlight"] },
  {
    slug: "product-manager",
    label: "Product Managers",
    themes: ["boardroom", "bold_corporate", "bento"],
  },
  { slug: "marketer", label: "Marketers", themes: ["bento", "spotlight", "glass"] },
  {
    slug: "consultant",
    label: "Consultants",
    themes: ["boardroom", "broadsheet", "case_file"],
  },
  {
    slug: "student",
    label: "Students",
    themes: ["classic_ats", "midnight", "retro_os", "academic_cv"],
  },
] as const;
