import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import { useCallback, useMemo } from "react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { siteConfig } from "@/lib/config/site";
import {
  generateLinkedInShareUrl,
  generateShareText,
  generateTwitterShareUrl,
  generateWhatsAppShareUrl,
  webShare,
} from "@/lib/utils/share";

export function getShareUrl(handle: string | undefined): string {
  if (globalThis.window !== undefined && handle) {
    return `${globalThis.window.location.origin}/@${handle}`;
  }

  return `${siteConfig.url}/@${handle ?? ""}`;
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
  handle?: string;
  title: string;
  name: string;
  onSuccess?: () => void;
}) {
  const { handle, title, name, onSuccess } = options;
  const { copied, copy } = useCopyToClipboard();

  const shareText = useMemo(() => generateShareText(name), [name]);
  const shareUrl = useMemo(() => getShareUrl(handle), [handle]);

  const onNativeShare = useCallback(async () => {
    try {
      await webShare({ title, text: shareText, url: shareUrl });
      onSuccess?.();
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        log("error", "Share failed", { ...errorFields(err) });
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
    copied,
    handleNativeShare: onNativeShare,
    handleTwitterShare: onTwitterShare,
    handleLinkedInShare: onLinkedInShare,
    handleWhatsAppShare: onWhatsAppShare,
    handleCopyLink: onCopyLink,
  };
}
