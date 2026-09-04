"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Check, Copy, Share2, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { LinkedInIcon, WhatsAppIcon } from "@/components/icons/BrandIcons";
import {
  DEFAULT_SHARE_VARIANT,
  shareButtonStyles,
  shareContainerStyles,
} from "@/lib/templates/share-variants";
import { cn } from "@/lib/utils/cn";
import { isWebShareSupported } from "@/lib/utils/share";
import { getLinkedInIconVariant, useShareActions } from "@/lib/utils/share-actions";
const shareBarVariants = cva("flex items-center gap-2 flex-wrap", {
  variants: {
    variant: shareContainerStyles,
  },
  defaultVariants: {
    variant: DEFAULT_SHARE_VARIANT,
  },
});

const buttonVariants = cva(
  "inline-flex items-center justify-center transition-colors duration-200 min-w-[44px] min-h-[44px]",
  {
    variants: {
      variant: shareButtonStyles,
    },
    defaultVariants: {
      variant: DEFAULT_SHARE_VARIANT,
    },
  },
);

interface ShareBarProps extends VariantProps<typeof shareBarVariants> {
  url?: string;
  handle?: string;
  title: string;
  name: string;
  className?: string;
}

export function ShareBar({ url, handle, title, name, variant, className }: ShareBarProps) {
  const [hasWebShare, setHasWebShare] = useState(false);

  useEffect(() => {
    setHasWebShare(isWebShareSupported());
  }, []);

  const {
    copied,
    handleNativeShare,
    handleTwitterShare,
    handleLinkedInShare,
    handleWhatsAppShare,
    handleCopyLink,
  } = useShareActions({ url, handle, title, name });

  return (
    <fieldset
      className={cn(shareBarVariants({ variant }), "border-none p-0 m-0", className)}
      aria-label="Share options"
    >
      {hasWebShare && (
        <button
          type="button"
          onClick={handleNativeShare}
          className={cn(buttonVariants({ variant }))}
          aria-label="Share this page"
        >
          <Share2 className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only sm:ml-1.5">Share</span>
        </button>
      )}

      <button
        type="button"
        onClick={handleTwitterShare}
        className={cn(buttonVariants({ variant }))}
        aria-label="Share on X (Twitter)"
      >
        <XIcon className="size-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only sm:ml-1.5">X</span>
      </button>

      <button
        type="button"
        onClick={handleLinkedInShare}
        className={cn(buttonVariants({ variant }))}
        aria-label="Share on LinkedIn"
      >
        <LinkedInIcon
          variant={getLinkedInIconVariant(variant)}
          className="size-4"
          aria-hidden={true}
        />
        <span className="sr-only sm:not-sr-only sm:ml-1.5">LinkedIn</span>
      </button>

      <button
        type="button"
        onClick={handleWhatsAppShare}
        className={cn(buttonVariants({ variant }))}
        aria-label="Share on WhatsApp"
      >
        <WhatsAppIcon className="size-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only sm:ml-1.5">WhatsApp</span>
      </button>

      <button
        type="button"
        onClick={handleCopyLink}
        className={cn(buttonVariants({ variant }))}
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
