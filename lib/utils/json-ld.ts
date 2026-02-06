/**
 * JSON-LD Structured Data Generator
 * Generates schema.org compliant structured data for resume profiles
 * to enable rich snippets in Google/Bing search results.
 */

import type { ResumeContent } from "@/lib/types/database";

// =============================================================================
// Types
// =============================================================================

interface JsonLdPerson {
  "@type": "Person";
  name: string;
  url: string;
  image?: string;
  jobTitle?: string;
  worksFor?: {
    "@type": "Organization";
    name: string;
  };
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
  dateCreated?: string;
  dateModified?: string;
  mainEntity: JsonLdPerson;
}

export interface JsonLdOptions {
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
const LINKEDIN_PATTERN = /^https?:\/\/(www\.)?linkedin\.com\/(in|company)\/[\w-]+\/?$/i;

/**
 * Validates GitHub profile URLs
 * Accepts: github.com/username
 */
const GITHUB_PATTERN = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/?$/i;

/**
 * Validates general website URLs
 * Basic validation - must be http(s) with a domain
 */
const WEBSITE_PATTERN = /^https?:\/\/[\w.-]+\.[a-z]{2,}(\/.*)?$/i;

function isValidLinkedInUrl(url: string): boolean {
  return LINKEDIN_PATTERN.test(url.trim());
}

function isValidGitHubUrl(url: string): boolean {
  return GITHUB_PATTERN.test(url.trim());
}

function isValidWebsiteUrl(url: string): boolean {
  return WEBSITE_PATTERN.test(url.trim());
}

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
 * Builds array of validated social profile URLs
 * Only includes URLs that pass validation
 */
function buildSameAsArray(contact: ResumeContent["contact"]): string[] | undefined {
  const urls: string[] = [];

  if (contact.linkedin && isValidLinkedInUrl(contact.linkedin)) {
    urls.push(contact.linkedin.trim());
  }

  if (contact.github && isValidGitHubUrl(contact.github)) {
    urls.push(contact.github.trim());
  }

  if (contact.website && isValidWebsiteUrl(contact.website)) {
    urls.push(contact.website.trim());
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
export function serializeJsonLd(jsonLd: JsonLdProfilePage): string {
  return JSON.stringify(jsonLd)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
