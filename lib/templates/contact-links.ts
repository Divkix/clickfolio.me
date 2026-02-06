import type { ResumeContent } from "@/lib/types/database";

export type ContactLinkType =
  | "email"
  | "phone"
  | "location"
  | "linkedin"
  | "github"
  | "website"
  | "behance"
  | "dribbble";

export interface ContactLinkDescriptor {
  href: string;
  label: string;
  icon: ContactLinkType;
  isExternal: boolean;
  type: ContactLinkType;
}

/**
 * Centralizes contact null-checking and href generation.
 * Templates iterate the returned array with their own styling.
 */
export function getContactLinks(contact: ResumeContent["contact"]): ContactLinkDescriptor[] {
  const links: ContactLinkDescriptor[] = [];

  if (contact.email) {
    links.push({
      href: `mailto:${contact.email}`,
      label: contact.email,
      icon: "email",
      isExternal: false,
      type: "email",
    });
  }

  if (contact.phone) {
    links.push({
      href: `tel:${contact.phone}`,
      label: contact.phone,
      icon: "phone",
      isExternal: false,
      type: "phone",
    });
  }

  if (contact.location) {
    links.push({
      href: "",
      label: contact.location,
      icon: "location",
      isExternal: false,
      type: "location",
    });
  }

  if (contact.linkedin) {
    links.push({
      href: contact.linkedin,
      label: "LinkedIn",
      icon: "linkedin",
      isExternal: true,
      type: "linkedin",
    });
  }

  if (contact.github) {
    links.push({
      href: contact.github,
      label: "GitHub",
      icon: "github",
      isExternal: true,
      type: "github",
    });
  }

  if (contact.website) {
    links.push({
      href: contact.website,
      label: "Website",
      icon: "website",
      isExternal: true,
      type: "website",
    });
  }

  if (contact.behance) {
    links.push({
      href: contact.behance,
      label: "Behance",
      icon: "behance",
      isExternal: true,
      type: "behance",
    });
  }

  if (contact.dribbble) {
    links.push({
      href: contact.dribbble,
      label: "Dribbble",
      icon: "dribbble",
      isExternal: true,
      type: "dribbble",
    });
  }

  return links;
}
