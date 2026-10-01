import type { ThemeId } from "@/lib/templates/theme-ids";

export interface ExampleGallery {
  slug: string;
  /** H1 and <title>; the target query, e.g. "marketing portfolio examples". */
  title: string;
  description: string;
  /** /for/<forSlug> role page this gallery pairs with. */
  forSlug: string;
  themes: readonly ThemeId[];
  /**
   * Hand-picked directory profiles. The page re-checks showInDirectory + isIndexableProfile on
   * every render, so a user who opts out or unpublishes drops out without a code change.
   */
  handles: readonly string[];
}

// ponytail: hand-curated handles; add a profession column filled by the parser once galleries
// need more than a few dozen profiles.
export const EXAMPLE_GALLERIES: readonly ExampleGallery[] = [
  {
    slug: "marketing",
    title: "Marketing Portfolio Examples",
    description:
      "Real marketing portfolio examples from digital marketers, social media managers, and content writers, each built from a PDF resume.",
    forSlug: "marketer",
    themes: ["bento", "spotlight", "glass"],
    handles: [
      "alfez",
      "expocity-tiktok",
      "glennbertferrer",
      "nicy",
      "aayaselim",
      "rayudu-allavarapu",
    ],
  },
  {
    slug: "engineering",
    title: "Engineering Portfolio Examples",
    description:
      "Real engineering portfolio examples from mechanical, chemical, textile, DevOps, and software engineers, each built from a PDF resume.",
    forSlug: "software-engineer",
    themes: ["dev_terminal", "minimalist_editorial", "classic_ats"],
    handles: [
      "adamalassaad",
      "vishal-m-23chr052",
      "yousuf",
      "tusharmangla",
      "adithya",
      "xditya",
      "divkix",
    ],
  },
  {
    slug: "student",
    title: "Student Portfolio Examples",
    description:
      "Real student portfolio examples from engineering, computer science, and business students, each built from a PDF resume.",
    forSlug: "student",
    themes: ["classic_ats", "midnight", "retro_os"],
    handles: [
      "adamalassaad",
      "anjasvaidya",
      "anwarbasha",
      "asmita",
      "ektagupta",
      "jonny",
      "moorejustice",
      "yashshah",
    ],
  },
];
