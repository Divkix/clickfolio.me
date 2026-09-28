import type { PrivacySettings } from "@/lib/db/schema/auth";
import type { ResumeContent } from "@/lib/types/database";
import { calculateCompleteness } from "@/lib/utils/profile-completeness";

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
    calculateCompleteness(content) >= 40
  );
}
