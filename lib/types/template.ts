import type { ThemeChrome } from "@/lib/templates/theme-chrome";
import type { ResumeContent } from "./database";

export interface TemplateProps {
  content: ResumeContent;
  share: ThemeChrome["share"];
  profile: {
    avatar_url: string | null;
    handle: string;
  };
  isPreview?: boolean;
}
