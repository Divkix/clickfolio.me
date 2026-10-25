import { Check, Copy, Share2, XIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { LinkedInIcon, WhatsAppIcon } from "@/components/icons/BrandIcons";
import type { ThemeChrome } from "@/lib/templates/theme-chrome";
import { cn } from "@/lib/utils/cn";
import { isWebShareSupported } from "@/lib/utils/share";
import { useShareActions } from "@/lib/utils/share-actions";

const subscribeToWebShare = () => () => {};

interface ShareBarProps {
  styles: ThemeChrome["share"];
  handle?: string;
  title: string;
  name: string;
  className?: string;
}

export function ShareBar({ handle, title, name, styles, className }: ShareBarProps) {
  const buttonClassName = cn(
    "inline-flex items-center justify-center transition-colors duration-200 min-w-[44px] min-h-[44px]",
    styles.button,
  );

  const hasWebShare = useSyncExternalStore(subscribeToWebShare, isWebShareSupported, () => false);

  const {
    copied,
    handleNativeShare,
    handleTwitterShare,
    handleLinkedInShare,
    handleWhatsAppShare,
    handleCopyLink,
  } = useShareActions({ handle, title, name });

  return (
    <fieldset
      className={cn("flex items-center gap-2 flex-wrap border-none p-0 m-0", className)}
      aria-label="Share options"
    >
      {hasWebShare && (
        <button
          type="button"
          onClick={handleNativeShare}
          className={buttonClassName}
          aria-label="Share this page"
        >
          <Share2 className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only sm:ml-1.5">Share</span>
        </button>
      )}

      <button
        type="button"
        onClick={handleTwitterShare}
        className={buttonClassName}
        aria-label="Share on X (Twitter)"
      >
        <XIcon className="size-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only sm:ml-1.5">X</span>
      </button>

      <button
        type="button"
        onClick={handleLinkedInShare}
        className={buttonClassName}
        aria-label="Share on LinkedIn"
      >
        <LinkedInIcon variant={styles.linkedInIcon} className="size-4" aria-hidden={true} />
        <span className="sr-only sm:not-sr-only sm:ml-1.5">LinkedIn</span>
      </button>

      <button
        type="button"
        onClick={handleWhatsAppShare}
        className={buttonClassName}
        aria-label="Share on WhatsApp"
      >
        <WhatsAppIcon className="size-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only sm:ml-1.5">WhatsApp</span>
      </button>

      <button
        type="button"
        onClick={handleCopyLink}
        className={buttonClassName}
        aria-label={copied ? "Link copied" : "Copy link"}
      >
        {copied ? (
          <Check className="size-4 text-success" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        <span className="sr-only sm:not-sr-only sm:ml-1.5">{copied ? "Copied" : "Copy"}</span>
      </button>
    </fieldset>
  );
}

export type { ShareBarProps };
