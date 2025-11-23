import type { ResumeContent } from "./database";

export interface TemplateProps {
  content: ResumeContent;
  profile: {
    avatar_url: string | null;
    handle: string;
  };
}
