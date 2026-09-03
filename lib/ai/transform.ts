import type { ResumeContentFormData } from "@/lib/schemas/resume";
import { z } from "zod";
import type { JsonValue, UnknownRecord } from "@/lib/types/json";
import { truncateText } from "@/lib/utils/format";
import { sanitizeEmail, sanitizeUrl } from "@/lib/utils/sanitization";

// Pre-compiled regex for URL validation (avoid per-call compilation overhead)
// Requires a path segment to appear THREE times consecutively before the URL is
// treated as pathological. A single repeated pair (e.g. `github.com/user/user`)
// is legitimate GitHub-style and must NOT be rejected.
const REPEATING_SEGMENT_PATTERN = /\/([^/]+)\/\1\/\1(?:\/|$)/;

/**
 * Validate URL with garbage pattern detection
 * Detects pathological patterns like repeating path segments.
 * Delegates scheme normalization to canonical sanitizeUrl,
 * then adds AI-specific checks (segment repetition, 12-segment cap).
 */
export function validateUrl(url: JsonValue): string {
  if (!url || !z.string().safeParse(url).success) return "";
  // SAFETY: zod safeParse above guarantees url is string, cast preserves type after validation.
  const trimmed = (url as string).trim();
  if (!trimmed) return "";

  // Max length check
  if (trimmed.length > 500) return "";

  // AI-specific: Detect repeating path segments (three consecutive identical segments)
  if (REPEATING_SEGMENT_PATTERN.test(trimmed)) return "";

  // AI-specific: Check for excessive path depth
  const pathSegments = trimmed.split("/").filter(Boolean);
  if (pathSegments.length > 12) return "";

  const normalized = sanitizeUrl(trimmed);
  if (!normalized) return "";

  try {
    const urlObj = new URL(normalized);
    if (!urlObj.hostname.includes(".")) return "";
    if (urlObj.hostname.length > 253) return "";
    if (REPEATING_SEGMENT_PATTERN.test(urlObj.pathname)) return "";
    return normalized;
  } catch {
    return "";
  }
}

/**
 * Normalize string - convert null/undefined to empty string, trim
 */
export function normalizeString(value: JsonValue, defaultVal = ""): string {
  if (value === null || value === undefined) return defaultVal;
  // eslint-disable-next-line typescript/no-base-to-string -- value is unknown; String() is intentional for non-object primitives
  if (!z.string().safeParse(value).success) return String(value);
  // SAFETY: zod safeParse above guarantees value is string, cast preserves type after validation.
  return (value as string).trim() || defaultVal;
}

/**
 * Normalize end_date values - treat "Present"/"Current" etc as empty
 */
export function normalizeEndDate(value: JsonValue): string {
  const normalized = normalizeString(value);
  if (!normalized) return "";
  const lower = normalized.toLowerCase();
  if (lower === "present" || lower === "current" || lower === "ongoing" || lower === "now") {
    return "";
  }
  return normalized;
}

/**
 * Transform AI response - lenient parsing with XSS protection and URL validation
 */
export function transformAiResponse(raw: JsonValue): UnknownRecord {
  if (!raw || !(raw instanceof Object) || Array.isArray(raw)) {
    return {
      full_name: "Unknown",
      headline: "Professional",
      summary: "",
      contact: { email: "" },
      experience: [],
    };
  }

  // SAFETY: null and object guard above ensures raw is a plain object; UnknownRecord is the safe JSON object representation for AI response manipulation.
  const data = raw as UnknownRecord;

  // Top-level fields
  data.full_name = truncateText(normalizeString(data.full_name, "Unknown"), 100);
  data.headline = truncateText(normalizeString(data.headline, "Professional"), 150);

  // Summary with fallback generation
  let summary = normalizeString(data.summary);
  if (!summary) {
    if (Array.isArray(data.experience) && data.experience.length > 0) {
      // SAFETY: Array.isArray and length guard above ensures data.experience has elements; element is an AI-constructed object compatible with UnknownRecord.
      const firstExp = data.experience[0] as UnknownRecord;
      if (firstExp?.description && z.string().safeParse(firstExp.description).success) {
        // SAFETY: zod safeParse above guarantees firstExp.description is string.
        const desc = (firstExp.description as string).trim();
        if (desc.length > 0) {
          summary = desc.slice(0, 500);
        }
      }
    }
    if (!summary) {
      const headline = normalizeString(data.headline, "Professional");
      summary = `Experienced ${headline.toLowerCase()} with a proven track record.`;
    }
  }
  data.summary = truncateText(summary, 2000);

  // Contact - validate URLs, sanitize email
  if (data.contact && data.contact instanceof Object && !Array.isArray(data.contact)) {
    // SAFETY: object guard above ensures data.contact is a non-null object; UnknownRecord is safe for dynamic contact field access.
    const c = data.contact as UnknownRecord;
    c.email = sanitizeEmail(normalizeString(c.email));
    c.phone = truncateText(normalizeString(c.phone), 30);
    c.location = truncateText(normalizeString(c.location), 100);
    c.linkedin = validateUrl(c.linkedin);
    c.github = validateUrl(c.github);
    c.website = validateUrl(c.website);
    c.behance = validateUrl(c.behance);
    c.dribbble = validateUrl(c.dribbble);
  } else {
    data.contact = { email: "" };
  }

  // Experience - filter garbage entries
  if (Array.isArray(data.experience)) {
    data.experience = data.experience.filter((exp) => {
      if (!exp || !(exp instanceof Object) || Array.isArray(exp)) return false;
      // SAFETY: null and object guard above ensures exp is a non-null object; UnknownRecord is the safe JSON record type for experience entries.
      const e = exp as UnknownRecord;
      // SAFETY: zod safeParse guarantees e.title/e.company/e.start_date/e.description are strings before cast.
      return (
        e.title &&
        z.string().safeParse(e.title).success &&
        (e.title as string).trim().length > 0 &&
        e.company &&
        z.string().safeParse(e.company).success &&
        (e.company as string).trim().length > 0 &&
        e.start_date &&
        z.string().safeParse(e.start_date).success &&
        (e.start_date as string).trim().length > 0 &&
        e.description &&
        z.string().safeParse(e.description).success &&
        (e.description as string).trim().length > 0
      );
    });
    // SAFETY: Array.isArray guard above ensures data.experience is an array; UnknownRecord[] is the safe type for iterating AI experience entries.
    for (const exp of data.experience as UnknownRecord[]) {
      exp.title = truncateText(normalizeString(exp.title), 150);
      exp.company = truncateText(normalizeString(exp.company), 150);
      exp.location = truncateText(normalizeString(exp.location), 100);
      exp.start_date = truncateText(normalizeString(exp.start_date), 50);
      exp.end_date = truncateText(normalizeEndDate(exp.end_date), 50);
      exp.description = truncateText(normalizeString(exp.description), 2000);
      // Coerce a plain string highlight into a single-element array to match
      // the schema's highlights: string[] shape.
      if (z.string().safeParse(exp.highlights).success) {
        // SAFETY: zod safeParse above guarantees exp.highlights is string, cast preserves type after validation.
        exp.highlights = [exp.highlights as string];
      }
      if (Array.isArray(exp.highlights)) {
        // SAFETY: zod safeParse guarantees highlight is string before cast.
        exp.highlights = exp.highlights
          .filter(
            (h): h is string => z.string().safeParse(h).success && (h as string).trim().length > 0,
          )
          .map((h) => truncateText((h as string).trim(), 500));
      }
    }
  } else {
    data.experience = [];
  }

  // Education - filter garbage entries
  if (Array.isArray(data.education)) {
    data.education = data.education.filter((edu) => {
      if (!edu || !(edu instanceof Object) || Array.isArray(edu)) return false;
      // SAFETY: null and object guard above ensures edu is a non-null object; UnknownRecord is the safe JSON record type for education entries.
      const e = edu as UnknownRecord;
      // SAFETY: zod safeParse guarantees e.degree/e.institution are strings before cast.
      return (
        e.degree &&
        z.string().safeParse(e.degree).success &&
        (e.degree as string).trim().length > 0 &&
        e.institution &&
        z.string().safeParse(e.institution).success &&
        (e.institution as string).trim().length > 0
      );
    });
    // SAFETY: Array.isArray guard above ensures data.education is an array; UnknownRecord[] is the safe type for iterating AI education entries.
    for (const edu of data.education as UnknownRecord[]) {
      edu.degree = truncateText(normalizeString(edu.degree), 150);
      edu.institution = truncateText(normalizeString(edu.institution), 150);
      edu.location = truncateText(normalizeString(edu.location), 100);
    }
  }

  // Skills - filter garbage entries
  if (Array.isArray(data.skills)) {
    data.skills = data.skills.filter((skill) => {
      if (!skill || !(skill instanceof Object) || Array.isArray(skill)) return false;
      // SAFETY: null and object guard above ensures skill is a non-null object; UnknownRecord is the safe JSON record type for skill entries.
      const s = skill as UnknownRecord;
      // SAFETY: zod safeParse guarantees s.category is string before cast.
      return (
        s.category &&
        z.string().safeParse(s.category).success &&
        (s.category as string).trim().length > 0 &&
        Array.isArray(s.items) &&
        s.items.length > 0
      );
    });
    // SAFETY: Array.isArray guard above ensures data.skills is an array; UnknownRecord[] is the safe type for iterating AI skill entries.
    for (const skill of data.skills as UnknownRecord[]) {
      skill.category = truncateText(normalizeString(skill.category), 100);
      if (Array.isArray(skill.items)) {
        // SAFETY: zod safeParse guarantees item is string before cast.
        skill.items = skill.items
          .filter(
            (i): i is string => z.string().safeParse(i).success && (i as string).trim().length > 0,
          )
          .map((i) => truncateText((i as string).trim(), 100));
      }
    }
  }
  // Certifications - filter garbage, validate URLs
  if (Array.isArray(data.certifications)) {
    data.certifications = data.certifications.filter((cert) => {
      if (!cert || !(cert instanceof Object) || Array.isArray(cert)) return false;
      // SAFETY: null and object guard above ensures cert is a non-null object; UnknownRecord is the safe JSON record type for certification entries.
      const c = cert as UnknownRecord;
      // SAFETY: zod safeParse guarantees c.name/c.issuer are strings before cast.
      return (
        c.name &&
        z.string().safeParse(c.name).success &&
        (c.name as string).trim().length > 0 &&
        c.issuer &&
        z.string().safeParse(c.issuer).success &&
        (c.issuer as string).trim().length > 0
      );
    });
    // SAFETY: Array.isArray guard above ensures data.certifications is an array; UnknownRecord[] is the safe type for iterating AI certification entries.
    for (const cert of data.certifications as UnknownRecord[]) {
      cert.name = truncateText(normalizeString(cert.name), 150);
      cert.issuer = truncateText(normalizeString(cert.issuer), 150);
      cert.url = validateUrl(cert.url);
    }
  }

  // Projects - filter garbage, validate URLs
  if (Array.isArray(data.projects)) {
    data.projects = data.projects.filter((proj) => {
      if (!proj || !(proj instanceof Object) || Array.isArray(proj)) return false;
      // SAFETY: null and object guard above ensures proj is a non-null object; UnknownRecord is the safe JSON record type for project entries.
      const p = proj as UnknownRecord;
      // SAFETY: zod safeParse guarantees p.title/p.description are strings before cast.
      return (
        p.title &&
        z.string().safeParse(p.title).success &&
        (p.title as string).trim().length > 0 &&
        p.description &&
        z.string().safeParse(p.description).success &&
        (p.description as string).trim().length > 0
      );
    });
    // SAFETY: Array.isArray guard above ensures data.projects is an array; UnknownRecord[] is the safe type for iterating AI project entries.
    for (const proj of data.projects as UnknownRecord[]) {
      proj.title = truncateText(normalizeString(proj.title), 150);
      proj.description = truncateText(normalizeString(proj.description), 1000);
      proj.url = validateUrl(proj.url);
      proj.image_url = validateUrl(proj.image_url);
      if (Array.isArray(proj.technologies)) {
        // SAFETY: zod safeParse guarantees technology is string before cast.
        proj.technologies = proj.technologies
          .filter(
            (t): t is string => z.string().safeParse(t).success && (t as string).trim().length > 0,
          )
          .map((t) => truncateText((t as string).trim(), 50));
      }
    }
  }

  return data;
}

/**
 * Final cleanup transformations - trim strings, extract LinkedIn from website, remove empty fields
 */
export function transformAiOutput(raw: ResumeContentFormData): ResumeContentFormData {
  const result = structuredClone(raw);

  /**
   * Recursively trim all string values in an object or array in-place.
   */
  const trimStrings = (obj: UnknownRecord): void => {
    if (obj === null || obj === undefined) return;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (item !== null && item instanceof Object) {
          // SAFETY: null and object guard above ensures item is a non-null object; UnknownRecord is safe for recursive trimming.
          trimStrings(item as UnknownRecord);
        }
      }
      return;
    }
    if (obj instanceof Object) {
      for (const key of Object.keys(obj)) {
        if (z.string().safeParse(obj[key]).success) {
          // SAFETY: string guard above guarantees obj[key] is string.
          obj[key] = (obj[key] as string).trim();
        } else if (obj[key] !== null && obj[key] instanceof Object) {
          // SAFETY: null and object guard above ensures obj[key] is a non-null object; UnknownRecord is safe for recursive trimming.
          trimStrings(obj[key] as UnknownRecord);
        }
      }
    }
  };

  // SAFETY: ResumeContentFormData is JSON-compatible and structurally compatible with UnknownRecord for trimming.
  trimStrings(result as UnknownRecord);

  // Extract LinkedIn from website if misplaced
  if (result.contact?.website?.includes("linkedin.com") && !result.contact.linkedin) {
    result.contact.linkedin = result.contact.website;
    delete result.contact.website;
  }

  // Remove empty contact fields
  if (result.contact) {
    for (const key of Object.keys(result.contact)) {
      // SAFETY: ResumeContentFormData contact is JSON-compatible and structurally compatible with UnknownRecord for dynamic empty-field removal.
      if ((result.contact as UnknownRecord)[key] === "") {
        // SAFETY: ResumeContentFormData contact is JSON-compatible and structurally compatible with UnknownRecord for dynamic key deletion.
        delete (result.contact as UnknownRecord)[key];
      }
    }
  }

  // Normalize project years to just the year
  if (Array.isArray(result.projects)) {
    for (const project of result.projects) {
      if (project?.year) {
        const yearMatch = project.year.match(/(\d{4})/);
        if (yearMatch) {
          project.year = yearMatch[1];
        }
      }
    }
  }

  // Remove empty location fields from experience
  if (Array.isArray(result.experience)) {
    for (const exp of result.experience) {
      if (exp?.location === "") {
        delete exp.location;
      }
      if (exp?.end_date === "") {
        delete exp.end_date;
      }
    }
  }

  // Remove empty fields from education
  if (Array.isArray(result.education)) {
    for (const edu of result.education) {
      if (edu?.location === "") delete edu.location;
      if (edu?.gpa === "") delete edu.gpa;
    }
  }

  // Remove empty arrays
  for (const key of ["skills", "certifications", "projects", "education"] as const) {
    if (Array.isArray(result[key]) && result[key].length === 0) {
      delete result[key];
    }
  }

  // Remove duplicate website/linkedin
  if (result.contact?.website === result.contact?.linkedin) {
    delete result.contact.website;
  }

  return result;
}
