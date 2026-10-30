import { notFound } from "@tanstack/react-router";
import { normalizeHandleInput } from "@/lib/schemas/handle";
import { DEMO_RESUME_CONTENT } from "@/lib/templates/demo-data";
import { THEME_CHROME } from "@/lib/templates/theme-chrome";
import { isValidThemeId } from "@/lib/templates/theme-ids";

export function previewPageData(id: string) {
  if (!isValidThemeId(id)) throw notFound();

  const content = DEMO_RESUME_CONTENT[id];
  const chrome = THEME_CHROME[id];

  return {
    id,
    content,
    chrome,
    profile: {
      avatar_url: null,
      handle: normalizeHandleInput(content.full_name),
    },
  };
}
