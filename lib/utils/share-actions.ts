"use client";

import { useCallback, useMemo } from "react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { siteConfig } from "@/lib/config/site";
import type { ThemeId } from "@/lib/templates/theme-ids";
import {
  generateLinkedInShareUrl,
  generateShareText,
  generateTwitterShareUrl,
  generateWhatsAppShareUrl,
  webShare,
} from "@/lib/utils/share";
import type { BrandIconVariant } from "@/components/icons/BrandIcons";

export function getShareUrl(handle: string | undefined): string {
  if (globalThis.window !== undefined && handle) {
    return `${globalThis.window.location.origin}/@${handle}`;
  }
  return `${siteConfig.url}/@${handle ?? ""}`;
}

export function getLinkedInIconVariant(
  themeId: ThemeId | (string & {}) | null | undefined,
): BrandIconVariant {
  switch (themeId) {
    case "glass-morphic":
    case "midnight":
    case "design-folio":
    case "dev-terminal":
      return "white";
    default:
      return "black";
  }
}

function handleTwitterShare(text: string, url: string): void {
  globalThis.window?.open(generateTwitterShareUrl(text, url), "_blank", "noopener,noreferrer");
}

function handleLinkedInShare(url: string): void {
  globalThis.window?.open(generateLinkedInShareUrl(url), "_blank", "noopener,noreferrer");
}

function handleWhatsAppShare(text: string, url: string): void {
  globalThis.window?.open(generateWhatsAppShareUrl(text, url), "_blank", "noopener,noreferrer");
}

async function handleCopyLink(
  url: string,
  copy: (
    text: string,
    opts: { successMessage: string; errorMessage: string; onSuccess?: () => void },
  ) => Promise<void>,
  options?: { onSuccess?: () => void },
): Promise<void> {
  await copy(url, {
    successMessage: "Link copied!",
    errorMessage: "Failed to copy link",
    onSuccess: options?.onSuccess,
  });
}

export function useShareActions(options: {
  url?: string;
  handle?: string;
  title: string;
  name: string;
  onSuccess?: () => void;
}) {
  const { url, handle, title, name, onSuccess } = options;
  const { copied, copy } = useCopyToClipboard();

  const shareText = useMemo(() => generateShareText(name), [name]);
  const shareUrl = useMemo(() => url || getShareUrl(handle), [url, handle]);

  const onNativeShare = useCallback(async () => {
    try {
      await webShare({ title, text: shareText, url: shareUrl });
      onSuccess?.();
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Share failed:", err);
      }
    }
  }, [title, shareText, shareUrl, onSuccess]);

  const onTwitterShare = useCallback(() => {
    handleTwitterShare(shareText, shareUrl);
    onSuccess?.();
  }, [shareText, shareUrl, onSuccess]);

  const onLinkedInShare = useCallback(() => {
    handleLinkedInShare(shareUrl);
    onSuccess?.();
  }, [shareUrl, onSuccess]);

  const onWhatsAppShare = useCallback(() => {
    handleWhatsAppShare(shareText, shareUrl);
    onSuccess?.();
  }, [shareText, shareUrl, onSuccess]);

  const onCopyLink = useCallback(async () => {
    await handleCopyLink(shareUrl, copy, { onSuccess });
  }, [shareUrl, copy, onSuccess]);

  return {
    shareUrl,
    shareText,
    copied,
    handleNativeShare: onNativeShare,
    handleTwitterShare: onTwitterShare,
    handleLinkedInShare: onLinkedInShare,
    handleWhatsAppShare: onWhatsAppShare,
    handleCopyLink: onCopyLink,
  };
}
