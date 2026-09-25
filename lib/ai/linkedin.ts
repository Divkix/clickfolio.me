/**
 * LinkedIn "Save to PDF" profile exports have a fixed layout (Apache FOP generated): a sidebar
 * block (Contact, Top Skills, Languages, Certifications, Honors-Awards) extracted before the main
 * column, `Page N of M` footers that land mid-section, and contact links followed by a
 * `(LinkedIn)` / `(Personal)` style label. Detecting them lets the parser strip that noise and
 * give the model format-specific rules.
 */

export type ResumeSource = "linkedin" | "generic";

export interface PdfInfo {
  author?: string;
  subject?: string;
}

const PAGE_FOOTER = /^[ \t]*Page \d+ of \d+[ \t]*$/m;

const PAGE_FOOTER_LINES = new RegExp(`${PAGE_FOOTER.source}\\n?`, "gm");

const LINKEDIN_PROFILE_LINK = /linkedin\.com\/in\/\S+\s*\(LinkedIn\)/i;

// A contact link on its own line followed by its label, either inline or on the next line.
const LABELLED_LINK =
  /^(\S+\.\S+)\s*\n?[ \t]*\((LinkedIn|Portfolio|Personal|Company|Blog|Other)\)[ \t]*$/gm;

export function detectResumeSource(text: string, info: PdfInfo = {}): ResumeSource {
  if (info.author === "LinkedIn" && /generated from profile/i.test(info.subject ?? "")) {
    return "linkedin";
  }

  return LINKEDIN_PROFILE_LINK.test(text) && PAGE_FOOTER.test(text) ? "linkedin" : "generic";
}

export function cleanLinkedInText(text: string): string {
  return text.replace(PAGE_FOOTER_LINES, "").replace(LABELLED_LINK, "$2: $1");
}

export const LINKEDIN_PROMPT_RULES = `This resume is a LinkedIn "Save to PDF" profile export. Format-specific rules:
- The text starts with a sidebar: Contact, Top Skills, Languages, Certifications, Honors-Awards. The person's name, headline (the line right after the name) and location follow it, then Summary, Experience, Education.
- Contact links are prefixed with their label, e.g. "LinkedIn: www.linkedin.com/in/x", "Portfolio: example.com", "Personal: github.com/x". Map linkedin.com to contact.linkedin, github.com to contact.github, and the first other personal site or portfolio to contact.website.
- Experience: a company name followed by a total duration line (e.g. "2 years 10 months") groups several roles at that company. Emit one experience entry per role and repeat the company name on each.
- Ignore duration text such as "(4 months)" or "2 years 10 months"; only use the start and end dates.
- Certifications have no issuer in this format. Leave issuer as an empty string; never guess it. A certification name can wrap onto a second line.
- Education lines look like "Degree, Field · (Start - End)". Use the end date as graduation_date.
- Put "Top Skills" into a skills category named "Top Skills". If the summary explicitly lists the person's stack or skills (e.g. "My stack: ..."), also add those items as their own category. Do not infer skills that are not written down.
- Some roles have no description. Leave description as an empty string rather than inventing one.
- Languages and Honors-Awards have no field in the schema; skip them.
- LinkedIn lists every internship, tutoring, teaching-assistant and student role. For professional_level, count only full-time roles after graduation; someone with only internships or a degree finished within the last year is student or entry_level.`;
