import { Globe, Mail, MapPin, Phone } from "lucide-react";
import type React from "react";
import { type BrandIconVariant, GitHubIcon, LinkedInIcon } from "@/components/icons/BrandIcons";
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
): React.ReactNode | null {
  const { className, size, variant = "black", strokeWidth, "aria-hidden": ariaHidden } = options;

  const lucideProps = {
    ...(className !== undefined && { className }),
    ...(size !== undefined && { size }),
    ...(strokeWidth !== undefined && { strokeWidth }),
    ...(ariaHidden !== undefined && { "aria-hidden": ariaHidden }),
  };

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
    case "behance":
    case "dribbble":
      return null;
  }
}
