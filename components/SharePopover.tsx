"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Check, Copy, LinkedinIcon, Share2, XIcon } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils";
import {
  copyToClipboard,
  generateLinkedInShareUrl,
  generateShareText,
  generateTwitterShareUrl,
  generateWhatsAppShareUrl,
  isWebShareSupported,
  webShare,
} from "@/lib/utils/share";

const triggerVariants = cva(
  "inline-flex items-center gap-2 px-3 py-2 rounded-full border shadow-lg transition-all duration-200",
  {
    variants: {
      variant: {
        "minimalist-editorial":
          "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900",
        "neo-brutalist":
          "bg-yellow-300 text-black border-2 border-black font-bold shadow-[4px_4px_0_0_black] hover:translate-x-0.5 hover:-translate-y-0.5",
        "glass-morphic":
          "bg-white/10 text-white/90 border-white/20 backdrop-blur-md hover:bg-white/20",
        "bento-grid":
          "bg-white text-neutral-700 border-neutral-200 shadow-sm dark:bg-neutral-900 dark:text-white dark:border-neutral-700",
        spotlight: "bg-orange-500 text-white border-orange-400 shadow-md",
        midnight: "bg-neutral-900 text-amber-200 border-amber-700/40 shadow-lg",
        "bold-corporate":
          "bg-white text-neutral-800 border-neutral-200 shadow-sm hover:bg-neutral-50",
        "classic-ats": "bg-white text-gray-700 border-gray-300 shadow-sm hover:bg-gray-50",
        "design-folio":
          "bg-[#1a1a1a] text-[#CCFF00] border-[#333] shadow-lg font-mono hover:border-[#CCFF00]",
        "dev-terminal":
          "bg-[#161b22] text-[#58a6ff] border-[#30363d] shadow-lg font-mono hover:border-[#58a6ff]",
      },
    },
    defaultVariants: {
      variant: "minimalist-editorial",
    },
  },
);

const panelVariants = cva(
  "absolute left-full bottom-0 ml-3 w-56 p-2 rounded-xl border shadow-xl animate-fade-in-up",
  {
    variants: {
      variant: {
        "minimalist-editorial": "bg-white/95 text-neutral-800 border-neutral-200",
        "neo-brutalist":
          "bg-yellow-300 text-black border-2 border-black shadow-[4px_4px_0_0_black]",
        "glass-morphic": "bg-white/10 text-white border-white/20 backdrop-blur-xl",
        "bento-grid":
          "bg-white/95 text-neutral-800 border-neutral-200 dark:bg-neutral-900/95 dark:text-neutral-100 dark:border-neutral-700",
        spotlight: "bg-orange-50 text-orange-900 border-orange-200",
        midnight: "bg-neutral-900/95 text-amber-100 border-amber-700/30",
        "bold-corporate": "bg-white text-neutral-800 border-neutral-200",
        "classic-ats": "bg-white text-gray-700 border-gray-300",
        "design-folio": "bg-[#1a1a1a] text-[#e0e0e0] border-[#333]",
        "dev-terminal": "bg-[#161b22] text-[#c9d1d9] border-[#30363d]",
      },
    },
    defaultVariants: {
      variant: "minimalist-editorial",
    },
  },
);

const itemVariants = cva(
  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
  {
    variants: {
      variant: {
        "minimalist-editorial":
          "bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200 hover:bg-neutral-100",
        "neo-brutalist": "bg-white text-black border-2 border-black font-bold hover:bg-yellow-300",
        "glass-morphic":
          "bg-white/10 text-white/80 hover:text-white hover:bg-white/20 border border-white/20",
        "bento-grid":
          "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:border-neutral-700",
        spotlight: "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200",
        midnight: "bg-amber-900/20 text-amber-200 hover:bg-amber-900/40 border border-amber-700/30",
        "bold-corporate": "bg-white text-neutral-700 hover:bg-neutral-50 border-neutral-200",
        "classic-ats": "bg-white text-gray-600 hover:text-gray-900 border-gray-300",
        "design-folio":
          "bg-[#1a1a1a] text-[#888] hover:text-[#CCFF00] border border-[#333] font-mono hover:border-[#CCFF00]",
        "dev-terminal":
          "bg-[#161b22] text-[#c9d1d9] hover:text-[#58a6ff] border border-[#30363d] font-mono",
      },
    },
    defaultVariants: {
      variant: "minimalist-editorial",
    },
  },
);

interface SharePopoverProps extends VariantProps<typeof triggerVariants> {
  /** The URL to share (optional if handle is provided) */
  url?: string;
  /** The user's handle (used to construct URL if url not provided) */
  handle?: string;
  /** The page title for share dialogs */
  title: string;
  /** The person's name for share text */
  name: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Floating share button with popup menu.
 * Theme-adaptive styling via variant prop.
 */
export function SharePopover({ url, handle, title, name, variant, className }: SharePopoverProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const popoverId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const shareText = generateShareText(name);
  const hasWebShare = isWebShareSupported();

  const shareUrl = useMemo(() => {
    if (url) return url;
    if (typeof window !== "undefined" && handle) {
      return `${window.location.origin}/@${handle}`;
    }
    return `${siteConfig.url}/@${handle ?? ""}`;
  }, [url, handle]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
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

  const handleNativeShare = useCallback(async () => {
    try {
      await webShare({ title, text: shareText, url: shareUrl });
      setOpen(false);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Share failed:", err);
      }
    }
  }, [title, shareText, shareUrl]);

  const handleTwitterShare = useCallback(() => {
    window.open(generateTwitterShareUrl(shareText, shareUrl), "_blank", "noopener,noreferrer");
    setOpen(false);
  }, [shareText, shareUrl]);

  const handleLinkedInShare = useCallback(() => {
    window.open(generateLinkedInShareUrl(shareUrl), "_blank", "noopener,noreferrer");
    setOpen(false);
  }, [shareUrl]);

  const handleWhatsAppShare = useCallback(() => {
    window.open(generateWhatsAppShareUrl(shareText, shareUrl), "_blank", "noopener,noreferrer");
    setOpen(false);
  }, [shareText, shareUrl]);

  const handleCopyLink = useCallback(async () => {
    try {
      await copyToClipboard(shareUrl);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
      setOpen(false);
    } catch {
      toast.error("Failed to copy link");
    }
  }, [shareUrl]);

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
              <LinkedinIcon className="size-4" aria-hidden="true" />
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
                <Check className="size-4 text-green-500" aria-hidden="true" />
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

// WhatsApp SVG icon (Lucide doesn't have it)
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export type { SharePopoverProps };
export type SharePopoverVariant = NonNullable<VariantProps<typeof triggerVariants>["variant"]>;
