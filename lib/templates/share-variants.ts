import { THEME_CHROME } from "@/lib/templates/theme-chrome";

export type SharePopoverVariant =
  (typeof THEME_CHROME)[keyof typeof THEME_CHROME]["share"]["variant"];

export const SHARE_VARIANT_KEYS = Object.values(THEME_CHROME).map(({ share }) => share.variant);

export const DEFAULT_SHARE_VARIANT: SharePopoverVariant = "minimalist-editorial";

// SAFETY: Every share alias is projected from the exhaustive theme table.
export const shareContainerStyles = Object.fromEntries(
  SHARE_VARIANT_KEYS.map((variant) => [variant, ""]),
) as Record<SharePopoverVariant, string>;

function projectShareStyles(field: "button" | "trigger" | "panel" | "item") {
  // SAFETY: Every share alias is projected from the exhaustive theme table.
  return Object.fromEntries(
    Object.values(THEME_CHROME).map(({ share }) => [share.variant, share[field]]),
  ) as Record<SharePopoverVariant, string>;
}

export const shareButtonStyles = projectShareStyles("button");
export const shareTriggerStyles = projectShareStyles("trigger");
export const sharePanelStyles = projectShareStyles("panel");
export const shareItemStyles = projectShareStyles("item");
