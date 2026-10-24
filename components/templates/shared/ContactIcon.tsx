import { Globe, Mail, MapPin, Phone } from "lucide-react";
import type React from "react";
import {
  BehanceIcon,
  type BrandIconVariant,
  DribbbleIcon,
  GitHubIcon,
  LinkedInIcon,
} from "@/components/icons/BrandIcons";
import type { ContactLinkType } from "@/lib/templates/contact-links";

export interface ContactIconOptions {
  className?: string;
  size?: number;
  variant?: BrandIconVariant;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
}

export function getContactIcon(
  type: ContactLinkType,
  options: ContactIconOptions = {},
): React.ReactNode {
  const { variant = "black", ...iconProps } = options;

  // Lucide treats an absent aria-hidden differently from an explicit undefined.
  if (iconProps["aria-hidden"] === undefined) delete iconProps["aria-hidden"];

  switch (type) {
    case "email":
      return <Mail {...iconProps} />;
    case "phone":
      return <Phone {...iconProps} />;
    case "location":
      return <MapPin {...iconProps} />;
    case "website":
      return <Globe {...iconProps} />;
    case "github":
      return <GitHubIcon {...iconProps} variant={variant} />;
    case "linkedin":
      return <LinkedInIcon {...iconProps} variant={variant} />;
    case "behance":
      return <BehanceIcon {...iconProps} />;
    case "dribbble":
      return <DribbbleIcon {...iconProps} />;
  }
}
