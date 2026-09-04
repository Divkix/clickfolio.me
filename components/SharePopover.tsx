"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Check, Copy, Share2, XIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { LinkedInIcon, WhatsAppIcon } from "@/components/icons/BrandIcons";
import {
  DEFAULT_SHARE_VARIANT,
  shareItemStyles,
  sharePanelStyles,
  shareTriggerStyles,
} from "@/lib/templates/share-variants";
import { cn } from "@/lib/utils/cn";
import { isWebShareSupported } from "@/lib/utils/share";
import { getLinkedInIconVariant, useShareActions } from "@/lib/utils/share-actions";
const triggerVariants = cva(
  "inline-flex items-center gap-2 px-3 py-2 rounded-full border shadow-lg transition-colors duration-200",
  {
    variants: {
      variant: shareTriggerStyles,
    },
    defaultVariants: {
      variant: DEFAULT_SHARE_VARIANT,
    },
  },
);

const panelVariants = cva(
  "absolute left-full bottom-0 ml-3 w-56 p-2 rounded-xl border shadow-xl animate-fade-in-up",
  {
    variants: {
      variant: sharePanelStyles,
    },
    defaultVariants: {
      variant: DEFAULT_SHARE_VARIANT,
    },
  },
);

const itemVariants = cva(
  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
  {
    variants: {
      variant: shareItemStyles,
    },
    defaultVariants: {
      variant: DEFAULT_SHARE_VARIANT,
    },
  },
);

interface SharePopoverProps extends VariantProps<typeof triggerVariants> {
  url?: string;
  handle?: string;
  title: string;
  name: string;
  className?: string;
}

export function SharePopover({ url, handle, title, name, variant, className }: SharePopoverProps) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const hasWebShare = isWebShareSupported();

  const {
    copied,
    handleNativeShare,
    handleTwitterShare,
    handleLinkedInShare,
    handleWhatsAppShare,
    handleCopyLink,
  } = useShareActions({
    url,
    handle,
    title,
    name,
    onSuccess: () => setOpen(false),
  });

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      // SAFETY: event.target is DOM Node from trusted pointerdown event; cast bridges EventTarget to Node for contains check.
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("fixed bottom-6 left-4 sm:left-6 z-40 print:hidden", className)}
    >
      <button
        type="button"
        onClick={handleToggle}
        className={cn(triggerVariants({ variant }))}
        aria-expanded={open}
        aria-controls={popoverId}
        aria-haspopup="dialog"
      >
        <Share2 className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline text-sm font-medium">Share</span>
      </button>

      {open && (
        <div
          id={popoverId}
          // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom popover; dialog element would require different focus management
          role="dialog"
          aria-label="Share options"
          className={cn(panelVariants({ variant }))}
        >
          <div className="flex flex-col gap-2">
            {hasWebShare && (
              <button
                type="button"
                onClick={handleNativeShare}
                className={cn(itemVariants({ variant }))}
                aria-label="Share this page"
              >
                <Share2 className="size-4" aria-hidden="true" />
                <span>Share</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleTwitterShare}
              className={cn(itemVariants({ variant }))}
              aria-label="Share on X (Twitter)"
            >
              <XIcon className="size-4" aria-hidden="true" />
              <span>X (Twitter)</span>
            </button>
            <button
              type="button"
              onClick={handleLinkedInShare}
              className={cn(itemVariants({ variant }))}
              aria-label="Share on LinkedIn"
            >
              <LinkedInIcon
                variant={getLinkedInIconVariant(variant)}
                className="size-4"
                aria-hidden={true}
              />
              <span>LinkedIn</span>
            </button>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className={cn(itemVariants({ variant }))}
              aria-label="Share on WhatsApp"
            >
              <WhatsAppIcon className="size-4" aria-hidden="true" />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className={cn(itemVariants({ variant }))}
              aria-label={copied ? "Link copied" : "Copy link"}
            >
              {copied ? (
                <Check className="size-4 text-success" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              <span>{copied ? "Copied" : "Copy link"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export type { SharePopoverProps };
export type { SharePopoverVariant } from "@/lib/templates/share-variants";
