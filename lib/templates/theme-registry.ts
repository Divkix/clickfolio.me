import BentoGrid from "@/components/templates/BentoGrid";
import BoldCorporate from "@/components/templates/BoldCorporate";
import GlassMorphic from "@/components/templates/GlassMorphic";
import Midnight from "@/components/templates/Midnight";
import MinimalistEditorial from "@/components/templates/MinimalistEditorial";
import NeoBrutalist from "@/components/templates/NeoBrutalist";
import Spotlight from "@/components/templates/Spotlight";
import type { TemplateProps } from "@/lib/types/template";

export const TEMPLATES = {
  bento: BentoGrid,
  bold_corporate: BoldCorporate,
  glass: GlassMorphic,
  midnight: Midnight,
  minimalist_editorial: MinimalistEditorial,
  neo_brutalist: NeoBrutalist,
  spotlight: Spotlight,
} as const;

export type ThemeId = keyof typeof TEMPLATES;

const DEFAULT_THEME: ThemeId = "minimalist_editorial";

/**
 * Get template component by theme ID
 * Falls back to default theme if ID is invalid
 */
export function getTemplate(themeId: string | null | undefined): React.FC<TemplateProps> {
  if (!themeId) return TEMPLATES[DEFAULT_THEME];
  return TEMPLATES[themeId as ThemeId] || TEMPLATES[DEFAULT_THEME];
}

/**
 * Theme metadata for UI display
 */
export const THEME_METADATA = {
  bento: {
    name: "Bento Grid",
    description: "Modern mosaic layout with colorful cards",
    category: "Modern",
    preview: "/previews/bento.png",
  },
  bold_corporate: {
    name: "Bold Corporate",
    description: "Executive typography with bold numbered sections",
    category: "Professional",
    preview: "/previews/bold-corporate.png",
  },
  glass: {
    name: "Glass Morphic",
    description: "Dark theme with frosted glass effects",
    category: "Modern",
    preview: "/previews/glass.png",
  },
  midnight: {
    name: "Midnight",
    description: "Dark minimal with serif headings and gold accents",
    category: "Modern",
    preview: "/previews/midnight.png",
  },
  minimalist_editorial: {
    name: "Minimalist Editorial",
    description: "Clean magazine-style layout with serif typography",
    category: "Professional",
    preview: "/previews/minimalist.png",
  },
  neo_brutalist: {
    name: "Neo Brutalist",
    description: "Bold design with thick borders and loud colors",
    category: "Creative",
    preview: "/previews/brutalist.png",
  },
  spotlight: {
    name: "Spotlight",
    description: "Warm creative portfolio with animated sections",
    category: "Creative",
    preview: "/previews/spotlight.png",
  },
} as const;
