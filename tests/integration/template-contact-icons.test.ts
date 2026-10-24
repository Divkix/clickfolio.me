import { Globe, Mail, MapPin, Phone } from "lucide-react";
import { type ComponentType, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { BehanceIcon, DribbbleIcon, GitHubIcon, LinkedInIcon } from "@/components/icons/BrandIcons";
import { type ContactIconOptions, getContactIcon } from "@/components/templates/shared/ContactIcon";
import type { ContactLinkType } from "@/lib/templates/contact-links";

const ICONS: Record<ContactLinkType, ComponentType<ContactIconOptions>> = {
  email: Mail,
  phone: Phone,
  location: MapPin,
  website: Globe,
  github: GitHubIcon,
  linkedin: LinkedInIcon,
  behance: BehanceIcon,
  dribbble: DribbbleIcon,
};

const OPTIONS: ContactIconOptions[] = [
  {},
  { className: undefined, size: undefined, strokeWidth: undefined, "aria-hidden": undefined },
  { className: "contact-icon", size: 18, strokeWidth: 1.75, variant: "white", "aria-hidden": true },
  { variant: "black", "aria-hidden": false },
];

describe("template contact icons", () => {
  for (const type of Object.keys(ICONS)) {
    // SAFETY: ICONS has exactly the ContactLinkType keys, checked by its Record type.
    const contactType = type as ContactLinkType;

    it.each(OPTIONS)(`preserves ${type} markup with %j`, (options) => {
      const {
        className,
        size,
        strokeWidth,
        variant = "black",
        "aria-hidden": ariaHidden,
      } = options;

      const glyphProps = {
        ...(className !== undefined && { className }),
        ...(size !== undefined && { size }),
        ...(ariaHidden !== undefined && { "aria-hidden": ariaHidden }),
      };

      const props =
        contactType === "github" || contactType === "linkedin"
          ? { ...glyphProps, variant }
          : contactType === "behance" || contactType === "dribbble"
            ? glyphProps
            : { ...glyphProps, ...(strokeWidth !== undefined && { strokeWidth }) };

      expect(renderToStaticMarkup(getContactIcon(contactType, options))).toBe(
        renderToStaticMarkup(createElement(ICONS[contactType], props)),
      );
    });
  }
});
