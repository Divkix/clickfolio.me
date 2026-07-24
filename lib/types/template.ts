import type { ResumeContent } from "./database";

/**
 * Prop bag passed to all resume template React components.
 * Combines parsed resume content with the user's public profile metadata.
 */
export interface TemplateProps {
  content: ResumeContent;
  profile: {
    /** User avatar URL or null if no avatar is set. */
    avatar_url: string | null;
    /** Public handle used in portfolio URLs (e.g., /@handle). */
    handle: string;
  };
  /** Whether the template is being rendered inside a preview modal (e.g., homepage preview). */
  isPreview?: boolean;
}
