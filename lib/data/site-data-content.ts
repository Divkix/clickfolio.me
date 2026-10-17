import type { ResumeContent } from "@/lib/types/database";
import { isIndexableContent } from "@/lib/seo/profile-indexability";

/**
 * Columns that must change together whenever `site_data.content` is written: the content and its
 * persisted indexability flag. Spread this instead of setting `content` directly, or SQL-side
 * indexability filters (sitemap, /explore, /examples) drift from the stored resume.
 */
export function siteDataContentColumns(content: ResumeContent) {
  return { content, contentIndexable: isIndexableContent(content) };
}
