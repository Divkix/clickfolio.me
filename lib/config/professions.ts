export interface Profession {
  slug: string;
  label: string;
}

export const PROFESSIONS: readonly Profession[] = [
  { slug: "software-engineer", label: "Software Engineers" },
  { slug: "designer", label: "Designers" },
  { slug: "product-manager", label: "Product Managers" },
  { slug: "marketer", label: "Marketers" },
  { slug: "consultant", label: "Consultants" },
  { slug: "student", label: "Students" },
] as const;
