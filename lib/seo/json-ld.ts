import type { Metadata } from "next";
import type { BlogPostMeta } from "@/lib/blog/posts";
import { authorPersona } from "@/lib/config/author";
import { FAQ_ITEMS } from "@/lib/config/faq";
import { siteConfig } from "@/lib/config/site";
import { buildPublicPageMetadata } from "@/lib/seo/page-metadata";
import type { ResumeContent } from "@/lib/types/database";
import type { UnknownRecord } from "@/lib/types/json";

interface JsonLdOccupation {
  "@type": "Occupation";
  name: string;
}

interface JsonLdRole {
  "@type": "Role";
  roleName: string;
  hasOccupation: JsonLdOccupation;
  startDate: string;
  endDate?: string;
}

interface JsonLdPerson {
  "@type": "Person";
  "@id"?: string;
  name: string;
  url: string;
  image?: string;
  jobTitle?: string;
  worksFor?: {
    "@type": "Organization";
    name: string;
  };
  hasOccupation?: JsonLdRole[];
  alumniOf?: Array<{
    "@type": "EducationalOrganization";
    name: string;
  }>;
  sameAs?: string[];
  knowsAbout?: string[];
  email?: string;
  description?: string;
}

interface JsonLdProfilePage {
  "@context": "https://schema.org";
  "@type": "ProfilePage";
  "@id"?: string;
  dateCreated?: string;
  dateModified?: string;
  mainEntity: JsonLdPerson;
}

interface JsonLdOptions {
  profileUrl: string;
  avatarUrl?: string | null;
  dateCreated?: string;
  dateModified?: string;
  includeEmail?: boolean;
}

const URL_PATTERNS = {
  linkedin: /^https?:\/\/(www\.)?linkedin\.com\/(in|company)\/[\w-]+\/?$/i,
  github: /^https?:\/\/(www\.)?github\.com\/[\w-]+\/?$/i,
  website: /^https?:\/\/[\w.-]+\.[a-z]{2,}(\/.*)?$/i,
  dribbble: /^https?:\/\/(www\.)?dribbble\.com\/[\w-]+\/?$/i,
  behance: /^https?:\/\/(www\.)?behance\.net\/[\w-]+\/?$/i,
} as const;

type UrlField = keyof typeof URL_PATTERNS;

const CONTACT_URL_FIELDS: UrlField[] = ["linkedin", "github", "website", "dribbble", "behance"];

function getCurrentEmployer(
  experience: ResumeContent["experience"],
): { title: string; company: string } | null {
  if (!experience || experience.length === 0) {
    return null;
  }

  const currentJob = experience.find((exp) => !exp.end_date);

  if (currentJob) {
    return {
      title: currentJob.title,
      company: currentJob.company,
    };
  }

  return null;
}

function buildWorkExperiences(experience: ResumeContent["experience"]): JsonLdRole[] | undefined {
  if (!experience || experience.length === 0) {
    return undefined;
  }

  const roles = experience
    .filter(
      (exp) =>
        exp.title && exp.title.trim().length > 0 && exp.company && exp.company.trim().length > 0,
    )
    .slice(0, 5)
    .map((exp) => {
      const role: JsonLdRole = {
        "@type": "Role",
        roleName: exp.title.trim(),
        hasOccupation: {
          "@type": "Occupation",
          name: exp.title.trim(),
        },
        startDate: exp.start_date.trim(),
      };

      if (exp.end_date && exp.end_date.trim().length > 0) {
        role.endDate = exp.end_date.trim();
      }

      return role;
    });

  return roles.length > 0 ? roles : undefined;
}

function buildSameAsArray(contact: ResumeContent["contact"]): string[] | undefined {
  const urls: string[] = [];

  for (const field of CONTACT_URL_FIELDS) {
    const value = contact[field];
    if (value && URL_PATTERNS[field].test(value.trim())) {
      urls.push(value.trim());
    }
  }

  return urls.length > 0 ? urls : undefined;
}

function flattenSkills(skills: ResumeContent["skills"]): string[] | undefined {
  if (!skills || skills.length === 0) {
    return undefined;
  }

  const allSkills = skills.flatMap((category) => category.items);

  const uniqueSkills = [...new Set(allSkills.filter((skill) => skill.trim().length > 0))];

  return uniqueSkills.length > 0 ? uniqueSkills : undefined;
}

function buildAlumniOf(
  education: ResumeContent["education"],
): Array<{ "@type": "EducationalOrganization"; name: string }> | undefined {
  if (!education || education.length === 0) {
    return undefined;
  }

  const alumni = education
    .filter((edu) => edu.institution && edu.institution.trim().length > 0)
    .map((edu) => ({
      "@type": "EducationalOrganization" as const,
      name: edu.institution,
    }));

  return alumni.length > 0 ? alumni : undefined;
}

export function generateResumeJsonLd(
  content: ResumeContent,
  options: JsonLdOptions,
): JsonLdProfilePage {
  const { profileUrl, avatarUrl, dateCreated, dateModified, includeEmail = false } = options;

  const person: JsonLdPerson = {
    "@type": "Person",
    "@id": `${profileUrl}#person`,
    name: content.full_name,
    url: profileUrl,
  };

  if (avatarUrl) {
    person.image = avatarUrl;
  }

  const currentEmployer = getCurrentEmployer(content.experience);
  if (currentEmployer) {
    person.jobTitle = currentEmployer.title;
    person.worksFor = {
      "@type": "Organization",
      name: currentEmployer.company,
    };
  }

  const hasOccupation = buildWorkExperiences(content.experience);
  if (hasOccupation) {
    person.hasOccupation = hasOccupation;
  }

  const alumniOf = buildAlumniOf(content.education);
  if (alumniOf) {
    person.alumniOf = alumniOf;
  }

  const sameAs = buildSameAsArray(content.contact);
  if (sameAs) {
    person.sameAs = sameAs;
  }

  const knowsAbout = flattenSkills(content.skills);
  if (knowsAbout) {
    person.knowsAbout = knowsAbout;
  }

  if (includeEmail && content.contact.email) {
    person.email = content.contact.email;
  }

  if (content.summary && content.summary.trim().length > 0) {
    person.description = content.summary;
  }

  const profilePage: JsonLdProfilePage = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${profileUrl}#webpage`,
    mainEntity: person,
  };

  if (dateCreated) {
    profilePage.dateCreated = dateCreated;
  }
  if (dateModified) {
    profilePage.dateModified = dateModified;
  }

  return profilePage;
}

export function serializeJsonLd(
  jsonLd: JsonLdProfilePage | UnknownRecord | UnknownRecord[],
): string {
  return JSON.stringify(jsonLd)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function generateHomepageJsonLd(): UnknownRecord[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      name: siteConfig.fullName,
      url: siteConfig.url,
      description: siteConfig.tagline,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${siteConfig.url}/explore?search={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${siteConfig.url}/#organization`,
      name: siteConfig.fullName,
      alternateName: [...siteConfig.alternateNames],
      url: siteConfig.url,
      logo: `${siteConfig.url}/icon-512.png`,
      description:
        "clickfolio.me is a free AI resume website builder that turns a PDF resume into a hosted personal portfolio website with a custom @handle URL.",
      foundingDate: "2025",
      sameAs: [...siteConfig.sameAs],
      founder: {
        "@type": "Person",
        name: siteConfig.founder.name,
        url: siteConfig.founder.url,
        sameAs: [...siteConfig.founder.sameAs],
      },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: siteConfig.supportEmail,
        url: `${siteConfig.url}/faq`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": `${siteConfig.url}/#software`,
      name: siteConfig.fullName,
      url: siteConfig.url,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      description: siteConfig.tagline,
    },
  ];
}

export function generateExploreJsonLd(
  users: Array<{ handle: string; name: string; headline?: string | null }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${siteConfig.url}/explore#webpage`,
    name: "Professional Portfolio Directory",
    description: "Browse professional portfolios and connect with talented individuals.",
    url: `${siteConfig.url}/explore`,
    isPartOf: {
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      name: siteConfig.fullName,
      url: siteConfig.url,
    },
    mainEntity: {
      "@type": "ItemList",
      "@id": `${siteConfig.url}/explore#directory`,
      numberOfItems: users.length,
      itemListOrder: "Unordered",
      itemListElement: users.map((u, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${siteConfig.url}/@${u.handle}`,
        name: u.name,
        ...(u.headline && { description: u.headline }),
      })),
    },
  };
}

export function generateFAQJsonLd(): UnknownRecord {
  return generateFAQPageJsonLd(FAQ_ITEMS);
}

export function generateFAQPageJsonLd(items: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };
}

function absoluteUrl(path: string): string {
  return path === "/" ? siteConfig.url : `${siteConfig.url}${path}`;
}

function blogAuthorJsonLd() {
  return {
    "@type": "Person" as const,
    name: authorPersona.name,
    description: authorPersona.bio,
    url: authorPersona.url,
  };
}

export function generateBreadcrumbListJsonLd(items: readonly { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function generatePageBreadcrumbJsonLd(pageName: string, pagePath: string) {
  return generateBreadcrumbListJsonLd([
    { name: "Home", path: "/" },
    { name: pageName, path: pagePath },
  ]);
}

export function generateBlogPostingJsonLd(post: BlogPostMeta) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${siteConfig.url}/blog/${post.slug}#article`,
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.dateModified ?? post.date,
    url: `${siteConfig.url}/blog/${post.slug}`,
    keywords: post.keywords?.join(", "),
    author: blogAuthorJsonLd(),
    publisher: {
      "@type": "Organization",
      name: siteConfig.fullName,
      url: siteConfig.url,
      logo: {
        "@type": "ImageObject",
        url: `${siteConfig.url}/icon-512.png`,
      },
    },
    isPartOf: {
      "@type": "Blog",
      "@id": `${siteConfig.url}/blog#blog`,
      name: `${siteConfig.fullName} Blog`,
      url: `${siteConfig.url}/blog`,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteConfig.url}/blog/${post.slug}#webpage`,
      url: `${siteConfig.url}/blog/${post.slug}`,
    },
  };
}

export function generateBlogListingJsonLd(posts: readonly BlogPostMeta[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${siteConfig.url}/blog#blog`,
    name: `${siteConfig.fullName} Blog`,
    url: `${siteConfig.url}/blog`,
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      datePublished: post.date,
      url: `${siteConfig.url}/blog/${post.slug}`,
      author: blogAuthorJsonLd(),
    })),
  };
}

export function generateWebPageJsonLd(
  name: string,
  path: string,
  description: string,
  dateModified?: string,
) {
  const base = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${siteConfig.url}${path}#webpage`,
    name,
    url: `${siteConfig.url}${path}`,
    description,
    isPartOf: {
      "@type": "WebSite",
      name: siteConfig.fullName,
      url: siteConfig.url,
    },
  } satisfies UnknownRecord;
  if (dateModified) {
    return { ...base, dateModified } satisfies UnknownRecord;
  }
  return base;
}

export function buildRolePageMetadata(params: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return buildPublicPageMetadata(params);
}

export function generateBreadcrumbJsonLd(handle: string, displayName: string) {
  return generateBreadcrumbListJsonLd([
    { name: "Home", path: "/" },
    { name: "Explore", path: "/explore" },
    { name: displayName, path: `/@${handle}` },
  ]);
}
