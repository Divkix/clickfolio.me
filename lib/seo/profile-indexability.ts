import type { PrivacySettings } from "@/lib/db/schema/auth";
import type { ResumeContent } from "@/lib/types/database";
import { calculateCompleteness } from "@/lib/utils/profile-completeness";

// Keep thin resumes out of search even when their section completeness is high.
const MIN_INDEXABLE_WORDS = 100;

function countWords(...values: (string | undefined)[]): number {
  return values.reduce((total, value) => {
    const text = value?.trim();

    return total + (text ? text.split(/\s+/).length : 0);
  }, 0);
}

function countVisibleWords(content: ResumeContent): number {
  let words = countWords(
    content.full_name,
    content.headline,
    content.summary,
    content.contact.email,
    content.contact.phone,
    content.contact.location,
  );

  for (const job of content.experience) {
    words += countWords(
      job.title,
      job.company,
      job.location,
      job.start_date,
      job.end_date,
      job.description,
      ...(job.highlights ?? []),
    );
  }

  for (const education of content.education ?? []) {
    words += countWords(
      education.degree,
      education.institution,
      education.location,
      education.graduation_date,
      education.gpa,
    );
  }

  for (const skill of content.skills ?? []) {
    words += countWords(skill.category, ...skill.items);
  }

  for (const project of content.projects ?? []) {
    words += countWords(
      project.title,
      project.description,
      project.year,
      project.url,
      ...(project.technologies ?? []),
    );
  }

  for (const certification of content.certifications ?? []) {
    words += countWords(certification.name, certification.issuer, certification.date);
  }

  return words;
}

const PLACEHOLDER_VALUES = {
  unknown: true,
  untitled: true,
  "your name": true,
  "your headline": true,
  test: true,
  resume: true,
  cv: true,
  "john doe": true,
  "jane doe": true,
} satisfies Record<string, true>;

function isRealLabel(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase();

  return Boolean(normalized && !Object.hasOwn(PLACEHOLDER_VALUES, normalized));
}

export function isIndexableProfile(
  content: ResumeContent,
  privacySettings: Pick<PrivacySettings, "hide_from_search">,
): boolean {
  return (
    !privacySettings.hide_from_search &&
    isRealLabel(content.full_name) &&
    isRealLabel(content.headline) &&
    (content.experience.length > 0 || (content.education?.length ?? 0) > 0) &&
    calculateCompleteness(content) >= 40 &&
    countVisibleWords(content) >= MIN_INDEXABLE_WORDS
  );
}
