/**
 * Shared contact-icon renderer for resume templates.
 *
 * Centralizes the per-template icon maps
 * (spotlightIconMap, midnightIconMap, dfIconMap, bentoIconMap, …).
 * Templates that previously maintained their own map can call
 * `getContactIcon(type, options)` to obtain the same rendered icon with the
 * same props they passed before.
 *
 * Bespoke icons that deviate from standard brand assets (e.g.
 * MinimalistEditorial's ArrowUpRight-for-LinkedIn, GlassMorphic's white-only
 * map with ExternalLink fallback) are intentionally left in those templates.
 */

import { Globe, Mail, MapPin, Phone } from "lucide-react";
import type React from "react";
import { type BrandIconVariant, GitHubIcon, LinkedInIcon } from "@/components/icons/BrandIcons";
import type { ContactLinkType } from "@/lib/templates/contact-links";

export interface ContactIconOptions {
  /**
   * Tailwind size class(es) passed directly to the icon (e.g. "w-4 h-4").
   * Mutually exclusive with `size` — prefer `className` for Tailwind-class
   * sizing, `size` for numeric/prop-driven sizing.
   */
  className?: string;
  /**
   * Numeric size in pixels, forwarded as the `size` prop to lucide icons
   * and the `size` prop to brand icons.  Use this when the call site already
   * uses the numeric prop (e.g. BentoGrid's `size={18}`).
   */
  size?: number;
  /**
   * Icon variant for brand assets (GitHub, LinkedIn).
   * Lucide icons are always `currentColor` and are not affected.
   */
  variant?: BrandIconVariant;
  /** Numeric stroke width forwarded to lucide icons. */
  strokeWidth?: number;
  /** Maps to the `aria-hidden` prop on the icon element. */
  "aria-hidden"?: boolean;
}

/**
 * Returns a ReactNode for the given `ContactLinkType`.
 *
 * Returns `null` for types that have no standard icon representation
 * (currently none, but keeps the return type nullable so callers handle it).
 *
 * @example
 * // Tailwind-class sizing (Spotlight, Midnight, BoldCorporate, ClassicATS):
 * getContactIcon("github", { className: "w-5 h-5", "aria-hidden": true })
 *
 * // Numeric sizing (BentoGrid, DesignFolio):
 * getContactIcon("github", { size: 18 })
 *
 * // White-variant brand icons (Midnight):
 * getContactIcon("github", { className: "w-4 h-4", variant: "white", "aria-hidden": true })
 */
export function getContactIcon(
  type: ContactLinkType,
  options: ContactIconOptions = {},
): React.ReactNode | null {
  const { className, size, variant = "black", strokeWidth, "aria-hidden": ariaHidden } = options;

  // Shared props for lucide icons
  const lucideProps = {
    ...(className !== undefined && { className }),
    ...(size !== undefined && { size }),
    ...(strokeWidth !== undefined && { strokeWidth }),
    ...(ariaHidden !== undefined && { "aria-hidden": ariaHidden }),
  };

  // Shared props for brand icons (BrandIconProps accepts className + size + variant)
  const brandProps = {
    ...(className !== undefined && { className }),
    ...(size !== undefined && { size }),
    ...(ariaHidden !== undefined && { "aria-hidden": ariaHidden }),
    variant,
  };

  switch (type) {
    case "email":
      return <Mail {...lucideProps} />;
    case "phone":
      return <Phone {...lucideProps} />;
    case "location":
      return <MapPin {...lucideProps} />;
    case "website":
      return <Globe {...lucideProps} />;
    case "github":
      return <GitHubIcon {...brandProps} />;
    case "linkedin":
      return <LinkedInIcon {...brandProps} />;
    // behance / dribbble have no standard icon in the shared set;
    // each template handles them inline with brand colour + text badge.
    case "behance":
    case "dribbble":
      return null;
  }
}
