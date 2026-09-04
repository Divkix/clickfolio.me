import type { ResumeContent } from "@/lib/types/database";

export function calculateCompleteness(content: ResumeContent): number {
  let score = 0;
  let total = 0;

  total += 10;
  if (content.full_name?.trim()) score += 10;

  total += 10;
  if (content.headline?.trim()) score += 10;

  total += 15;
  if (content.summary?.trim()) score += 15;

  total += 10;
  if (content.contact?.email) score += 10;

  total += 20;
  if (content.experience?.length > 0) score += 20;

  total += 15;
  if (content.education && content.education.length > 0) score += 15;

  total += 10;
  if (content.skills && content.skills.length > 0) score += 10;

  total += 10;
  if (content.certifications && content.certifications.length > 0) score += 10;

  return Math.round((score / total) * 100);
}

export function getProfileSuggestions(content: ResumeContent): string[] {
  const suggestions: string[] = [];

  if (!content.education || content.education.length === 0) {
    suggestions.push("Add your education background");
  }

  if (!content.skills || content.skills.length === 0) {
    suggestions.push("List your technical skills");
  }

  if (!content.certifications || content.certifications.length === 0) {
    suggestions.push("Add certifications to stand out");
  }

  if (content.experience.length < 2) {
    suggestions.push("Add more work experience entries");
  }

  if (!content.contact.linkedin && !content.contact.github) {
    suggestions.push("Link your professional social profiles");
  }

  return suggestions;
}
