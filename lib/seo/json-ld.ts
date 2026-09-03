/**
 * JSON-LD Structured Data Generator
 * Generates schema.org compliant structured data for resume profiles
 * to enable rich snippets in Google/Bing search results.
 */

import type { Metadata } from "next";
import type { BlogPostMeta } from "@/lib/blog/posts";
import { authorPersona } from "@/lib/config/author";
import { FAQ_ITEMS } from "@/lib/config/faq";
import { siteConfig } from "@/lib/config/site";
import { buildPublicPageMetadata } from "@/lib/seo/page-metadata";
import type { ResumeContent } from "@/lib/types/database";
import type { UnknownRecord } from "@/lib/types/json";

// =============================================================================
// Types
// =============================================================================

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
  /** Canonical identifier for the person (e.g., profile URL + #person). */
  "@id"?: string;
  /** Full name of the person. */
  name: string;
  /** URL of the profile page. */
  url: string;
  /** Avatar or profile image URL. */
  image?: string;
  /** Current job title. */
  jobTitle?: string;
  /** Current employer as an Organization. */
  worksFor?: {
    "@type": "Organization";
    name: string;
  };
  /** Work experience as schema.org Role nodes. */
  hasOccupation?: JsonLdRole[];
  /** Educational institutions attended. */
  alumniOf?: Array<{
    "@type": "EducationalOrganization";
    name: string;
  }>;
  /** Validated social profile URLs (LinkedIn, GitHub, etc.). */
  sameAs?: string[];
  /** Flattened skill names for the knowsAbout field. */
  knowsAbout?: string[];
  /** Email address (only included when privacy allows). */
  email?: string;
  /** Resume summary or bio. */
  description?: string;
}

/** schema.org ProfilePage wrapping the Person entity. */
interface JsonLdProfilePage {
  "@context": "https://schema.org";
  "@type": "ProfilePage";
  /** Canonical identifier for the profile page (e.g., profile URL + #webpage). */
  "@id"?: string;
  /** ISO date string when the profile was first created. */
  dateCreated?: string;
  /** ISO date string when the profile was last modified. */
  dateModified?: string;
  /** The Person entity that is the main subject of this page. */
  mainEntity: JsonLdPerson;
}

interface JsonLdOptions {
  profileUrl: string;
  avatarUrl?: string | null;
  dateCreated?: string;
  dateModified?: string;
  includeEmail?: boolean;
}

// =============================================================================
// URL Validation Patterns
// =============================================================================

/**
 * Validates LinkedIn profile/company URLs
 * Accepts: linkedin.com/in/username, linkedin.com/company/name
 */
const URL_PATTERNS = {
  linkedin: /^https?:\/\/(www\.)?linkedin\.com\/(in|company)\/[\w-]+\/?$/i,
  github: /^https?:\/\/(www\.)?github\.com\/[\w-]+\/?$/i,
  website: /^https?:\/\/[\w.-]+\.[a-z]{2,}(\/.*)?$/i,
  dribbble: /^https?:\/\/(www\.)?dribbble\.com\/[\w-]+\/?$/i,
  behance: /^https?:\/\/(www\.)?behance\.net\/[\w-]+\/?$/i,
} as const;

type UrlField = keyof typeof URL_PATTERNS;

const CONTACT_URL_FIELDS: UrlField[] = ["linkedin", "github", "website", "dribbble", "behance"];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extracts current employer from experience array
 * A job is considered "current" if it has no end_date
 */
function getCurrentEmployer(
  experience: ResumeContent["experience"],
): { title: string; company: string } | null {
  if (!experience || experience.length === 0) {
    return null;
  }

  // Find first job without end_date (current job)
  const currentJob = experience.find((exp) => !exp.end_date);

  if (currentJob) {
    return {
      title: currentJob.title,
      company: currentJob.company,
    };
  }

  return null;
}

/**
 * Builds schema.org EmployeeRole nodes from resume experience
 * Includes company, title, and dates. Omits endDate for current roles.
 * Limited to 5 entries to keep payload reasonable.
 */
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

/**
 * Builds array of validated social profile URLs
 * Only includes URLs that pass validation
 */
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

/**
 * Flattens skill categories into a single array of skill names
 */
function flattenSkills(skills: ResumeContent["skills"]): string[] | undefined {
  if (!skills || skills.length === 0) {
    return undefined;
  }

  const allSkills = skills.flatMap((category) => category.items);

  // Remove duplicates and empty strings
  const uniqueSkills = [...new Set(allSkills.filter((skill) => skill.trim().length > 0))];

  return uniqueSkills.length > 0 ? uniqueSkills : undefined;
}

/**
 * Builds alumniOf array from education data
 * Maps each education entry to an EducationalOrganization
 */
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

// =============================================================================
// Main Generator
// =============================================================================

/**
 * Generates JSON-LD structured data for a resume profile
 *
 * @param content - Parsed resume content
 * @param options - Additional options (profileUrl, avatarUrl, etc.)
 * @returns JSON-LD object conforming to schema.org ProfilePage + Person
 *
 * @example
 * const jsonLd = generateResumeJsonLd(content, {
 *   profileUrl: "https://clickfolio.me/@john-doe",
 *   avatarUrl: "https://example.com/avatar.jpg",
 * });
 */
export function generateResumeJsonLd(
  content: ResumeContent,
  options: JsonLdOptions,
): JsonLdProfilePage {
  const { profileUrl, avatarUrl, dateCreated, dateModified, includeEmail = false } = options;

  // Build Person entity
  const person: JsonLdPerson = {
    "@type": "Person",
    "@id": `${profileUrl}#person`,
    name: content.full_name,
    url: profileUrl,
  };

  // Add image if available
  if (avatarUrl) {
    person.image = avatarUrl;
  }

  // Add current job title and employer
  const currentEmployer = getCurrentEmployer(content.experience);
  if (currentEmployer) {
    person.jobTitle = currentEmployer.title;
    person.worksFor = {
      "@type": "Organization",
      name: currentEmployer.company,
    };
  }

  // Add work experience as hasOccupation (EmployeeRole nodes)
  const hasOccupation = buildWorkExperiences(content.experience);
  if (hasOccupation) {
    person.hasOccupation = hasOccupation;
  }

  // Add education as alumniOf
  const alumniOf = buildAlumniOf(content.education);
  if (alumniOf) {
    person.alumniOf = alumniOf;
  }

  // Add social profiles
  const sameAs = buildSameAsArray(content.contact);
  if (sameAs) {
    person.sameAs = sameAs;
  }

  // Add skills
  const knowsAbout = flattenSkills(content.skills);
  if (knowsAbout) {
    person.knowsAbout = knowsAbout;
  }

  // Add email if explicitly requested (usually not for privacy)
  if (includeEmail && content.contact.email) {
    person.email = content.contact.email;
  }

  // Add summary as description
  if (content.summary && content.summary.trim().length > 0) {
    person.description = content.summary;
  }

  // Build ProfilePage wrapper
  const profilePage: JsonLdProfilePage = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${profileUrl}#webpage`,
    mainEntity: person,
  };

  // Add dates if available
  if (dateCreated) {
    profilePage.dateCreated = dateCreated;
  }
  if (dateModified) {
    profilePage.dateModified = dateModified;
  }

  return profilePage;
}

/**
 * Serializes JSON-LD to a string for embedding in HTML
 *
 * SECURITY: Escapes characters that could break out of the script tag context.
 * JSON.stringify does NOT escape angle brackets, so a malicious string like
 * "</script><script>alert(1)//" would break out of the JSON-LD script tag.
 * We escape < and > to their Unicode equivalents to prevent XSS.
 *
 * Also escapes U+2028 (LINE SEPARATOR) and U+2029 (PARAGRAPH SEPARATOR)
 * which are valid JSON but can break JavaScript parsing in some contexts.
 */
export function serializeJsonLd(
  jsonLd: JsonLdProfilePage | UnknownRecord | UnknownRecord[],
): string {
  return JSON.stringify(jsonLd)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// =============================================================================
// Homepage & Breadcrumb Generators
// =============================================================================

/**
 * Generates JSON-LD for the homepage: WebSite + Organization schemas.
 */
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

/**
 * Generates CollectionPage JSON-LD for the explore/directory page.
 */
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

/**
 * Generates FAQPage JSON-LD for the homepage.
 */
export function generateFAQJsonLd(): UnknownRecord {
  return generateFAQPageJsonLd(FAQ_ITEMS);
}

/**
 * Generates FAQPage JSON-LD from an arbitrary list of Q&A items.
 * Used by profession landing pages and blog posts to expose their own FAQs
 * as rich results and AI-extractable answers.
 */
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

/**
 * Absolute URL for a site path. Home (`/`) is the origin with no trailing slash,
 * matching the existing BreadcrumbList `item` values.
 */
function absoluteUrl(path: string): string {
  return path === "/" ? siteConfig.url : `${siteConfig.url}${path}`;
}

/**
 * Editorial byline used on blog JSON-LD. Comes from `authorPersona` — never invent
 * a personal author name or a publish date that is not on the post.
 */
function blogAuthorJsonLd() {
  return {
    "@type": "Person" as const,
    name: authorPersona.name,
    description: authorPersona.bio,
    url: authorPersona.url,
  };
}

/**
 * BreadcrumbList from the visible crumb trail (label + href). Used by
 * `components/ui/breadcrumb.tsx` so the on-page nav and the schema stay in sync.
 */
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

/**
 * Generates a generic 2-item BreadcrumbList: Home > Page.
 * Reusable for for/ pages, FAQ, About (pages without the visible Breadcrumb nav).
 */
export function generatePageBreadcrumbJsonLd(pageName: string, pagePath: string) {
  return generateBreadcrumbListJsonLd([
    { name: "Home", path: "/" },
    { name: pageName, path: pagePath },
  ]);
}

/**
 * BlogPosting for an individual post. headline/datePublished/author come from
 * `BlogPostMeta` + `authorPersona` — no invented authors or dates.
 */
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

/**
 * Blog listing schema: a Blog whose `blogPost` entries are BlogPosting objects
 * built from existing `BLOG_POSTS` fields only.
 */
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

/**
 * Generates WebPage JSON-LD for informational pages.
 */
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

/**
 * Builds the Next.js Metadata object for a /for/<role> profession landing page.
 * Shared by every app/for/<role>/page.tsx so the per-page `export const metadata`
 * stays a one-line call. Delegates to `buildPublicPageMetadata` so og:url,
 * og:type, and twitter:card/images are always set (not inherited from root).
 */
export function buildRolePageMetadata(params: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return buildPublicPageMetadata(params);
}

/**
 * Generates BreadcrumbList JSON-LD for profile pages: Home > Explore > @name
 */
export function generateBreadcrumbJsonLd(handle: string, displayName: string) {
  return generateBreadcrumbListJsonLd([
    { name: "Home", path: "/" },
    { name: "Explore", path: "/explore" },
    { name: displayName, path: `/@${handle}` },
  ]);
}
