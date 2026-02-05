import { sanitizeEmail } from "@/lib/utils/sanitization";
import type { ResumeSchema } from "./schema";

// Pre-compiled regex for URL validation (avoid per-call compilation overhead)
const REPEATING_SEGMENT_PATTERN = /\/([^/]+)\/\1(?:\/|$)/;

/**
 * Normalize URL - add protocol if missing, return empty string if invalid
 */
export function normalizeUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  // Already has valid protocol
  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("mailto:")) {
    return trimmed;
  }
  // Block dangerous protocols
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return "";
  }
  // Add https:// to URLs without protocol
  return `https://${trimmed}`;
}

/**
 * Validate URL with garbage pattern detection
 * Detects pathological patterns like repeating path segments
 */
export function validateUrl(url: unknown): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  // Max length check
  if (trimmed.length > 500) return "";

  // Detect repeating path segments
  if (REPEATING_SEGMENT_PATTERN.test(trimmed)) return "";

  // Check for excessive path depth
  const pathSegments = trimmed.split("/").filter(Boolean);
  if (pathSegments.length > 12) return "";

  const normalized = normalizeUrl(trimmed);
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
 * Truncate string to max length with ellipsis
 */
export function truncateString(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

/**
 * Normalize string - convert null/undefined to empty string, trim
 */
export function normalizeString(value: unknown, defaultVal = ""): string {
  if (value === null || value === undefined) return defaultVal;
  if (typeof value !== "string") return String(value);
  return value.trim() || defaultVal;
}

/**
 * Normalize end_date values - treat "Present"/"Current" etc as empty
 */
export function normalizeEndDate(value: unknown): string {
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
export function transformAiResponse(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") {
    return {
      full_name: "Unknown",
      headline: "Professional",
      summary: "",
      contact: { email: "" },
      experience: [],
    };
  }

  const data = raw as Record<string, unknown>;

  // Top-level fields
  data.full_name = truncateString(normalizeString(data.full_name, "Unknown"), 100);
  data.headline = truncateString(normalizeString(data.headline, "Professional"), 150);

  // Summary with fallback generation
  let summary = normalizeString(data.summary);
  if (!summary) {
    if (Array.isArray(data.experience) && data.experience.length > 0) {
      const firstExp = data.experience[0] as Record<string, unknown>;
      if (firstExp?.description && typeof firstExp.description === "string") {
        const desc = firstExp.description.trim();
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
  data.summary = truncateString(summary, 2000);

  // Contact - validate URLs, sanitize email
  if (data.contact && typeof data.contact === "object") {
    const c = data.contact as Record<string, unknown>;
    c.email = sanitizeEmail(normalizeString(c.email));
    c.phone = truncateString(normalizeString(c.phone), 30);
    c.location = truncateString(normalizeString(c.location), 100);
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
      if (!exp || typeof exp !== "object") return false;
      const e = exp as Record<string, unknown>;
      return (
        e.title &&
        typeof e.title === "string" &&
        e.title.trim().length > 0 &&
        e.company &&
        typeof e.company === "string" &&
        e.company.trim().length > 0 &&
        e.start_date &&
        typeof e.start_date === "string" &&
        e.start_date.trim().length > 0
      );
    });
    for (const exp of data.experience as Record<string, unknown>[]) {
      exp.title = truncateString(normalizeString(exp.title), 150);
      exp.company = truncateString(normalizeString(exp.company), 150);
      exp.location = truncateString(normalizeString(exp.location), 100);
      exp.start_date = truncateString(normalizeString(exp.start_date), 50);
      exp.end_date = truncateString(normalizeEndDate(exp.end_date), 50);
      exp.description = truncateString(normalizeString(exp.description), 2000);
      if (Array.isArray(exp.highlights)) {
        exp.highlights = exp.highlights
          .filter((h): h is string => typeof h === "string" && h.trim().length > 0)
          .map((h) => truncateString(h.trim(), 500));
      }
    }
  } else {
    data.experience = [];
  }

  // Education - filter garbage entries
  if (Array.isArray(data.education)) {
    data.education = data.education.filter((edu) => {
      if (!edu || typeof edu !== "object") return false;
      const e = edu as Record<string, unknown>;
      return e.degree && typeof e.degree === "string" && e.degree.trim().length > 0;
    });
    for (const edu of data.education as Record<string, unknown>[]) {
      edu.degree = truncateString(normalizeString(edu.degree), 150);
      edu.institution = truncateString(normalizeString(edu.institution), 150);
      edu.location = truncateString(normalizeString(edu.location), 100);
    }
  }

  // Skills - filter garbage entries
  if (Array.isArray(data.skills)) {
    data.skills = data.skills.filter((skill) => {
      if (!skill || typeof skill !== "object") return false;
      const s = skill as Record<string, unknown>;
      return (
        s.category &&
        typeof s.category === "string" &&
        s.category.trim().length > 0 &&
        Array.isArray(s.items) &&
        s.items.length > 0
      );
    });
    for (const skill of data.skills as Record<string, unknown>[]) {
      skill.category = truncateString(normalizeString(skill.category), 100);
      if (Array.isArray(skill.items)) {
        skill.items = skill.items
          .filter((i): i is string => typeof i === "string" && i.trim().length > 0)
          .map((i) => truncateString(i.trim(), 100));
      }
    }
  }

  // Certifications - filter garbage, validate URLs
  if (Array.isArray(data.certifications)) {
    data.certifications = data.certifications.filter((cert) => {
      if (!cert || typeof cert !== "object") return false;
      const c = cert as Record<string, unknown>;
      return c.name && typeof c.name === "string" && c.name.trim().length > 0;
    });
    for (const cert of data.certifications as Record<string, unknown>[]) {
      cert.name = truncateString(normalizeString(cert.name), 150);
      cert.issuer = truncateString(normalizeString(cert.issuer), 150);
      cert.url = validateUrl(cert.url);
    }
  }

  // Projects - filter garbage, validate URLs
  if (Array.isArray(data.projects)) {
    data.projects = data.projects.filter((proj) => {
      if (!proj || typeof proj !== "object") return false;
      const p = proj as Record<string, unknown>;
      return p.title && typeof p.title === "string" && p.title.trim().length > 0;
    });
    for (const proj of data.projects as Record<string, unknown>[]) {
      proj.title = truncateString(normalizeString(proj.title), 150);
      proj.description = truncateString(normalizeString(proj.description), 1000);
      proj.url = validateUrl(proj.url);
      proj.image_url = validateUrl(proj.image_url);
      if (Array.isArray(proj.technologies)) {
        proj.technologies = proj.technologies
          .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
          .map((t) => truncateString(t.trim(), 50));
      }
    }
  }

  return data;
}

/**
 * Final cleanup transformations - trim strings, extract LinkedIn from website, remove empty fields
 */
export function transformAiOutput(raw: ResumeSchema): ResumeSchema {
  const result = structuredClone(raw);

  const trimStrings = (obj: Record<string, unknown>): void => {
    if (obj === null || obj === undefined) return;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === "object" && item !== null) {
          trimStrings(item as Record<string, unknown>);
        }
      }
      return;
    }
    if (typeof obj === "object") {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === "string") {
          obj[key] = (obj[key] as string).trim();
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          trimStrings(obj[key] as Record<string, unknown>);
        }
      }
    }
  };

  trimStrings(result);

  // Extract LinkedIn from website if misplaced
  if (result.contact?.website?.includes("linkedin.com") && !result.contact.linkedin) {
    result.contact.linkedin = result.contact.website;
    delete result.contact.website;
  }

  // Remove empty contact fields
  if (result.contact) {
    for (const key of Object.keys(result.contact)) {
      if ((result.contact as Record<string, unknown>)[key] === "") {
        delete (result.contact as Record<string, unknown>)[key];
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

/**
 * Sanitize raw error responses from service bindings into human-readable messages
 */
export function sanitizeServiceError(responseText: string, status: number): string {
  if (status === 504) return "Service timed out. Please try again.";
  if (status === 502) return "Service temporarily unavailable. Please try again.";
  if (status === 429) return "AI service rate limited. Please wait a moment and try again.";

  const text = responseText.trim();
  if (!text) return "An unexpected error occurred. Please try again.";

  if (text.startsWith("<") || text.toLowerCase().includes("<html")) {
    return "Resume parsing service unavailable. Please try again.";
  }

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed.error === "string" && parsed.error.trim()) {
        const msg = parsed.error.trim();
        return msg.length > 200 ? `${msg.slice(0, 200)}...` : msg;
      }
    } catch {
      // Not valid JSON
    }
  }

  if (text.length > 200) {
    return `${text.slice(0, 200)}...`;
  }

  return text;
}
