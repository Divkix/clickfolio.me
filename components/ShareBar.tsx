"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Check, Copy, LinkedinIcon, Share2, XIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
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

const shareBarVariants = cva("flex items-center gap-2 flex-wrap", {
  variants: {
    variant: {
      "minimalist-editorial": "",
      "neo-brutalist": "",
      "glass-morphic": "",
      "bento-grid": "",
      spotlight: "",
      midnight: "",
      "bold-corporate": "",
      "classic-ats": "",
      "design-folio": "",
      "dev-terminal": "",
    },
  },
  defaultVariants: {
    variant: "minimalist-editorial",
  },
});

const buttonVariants = cva(
  "inline-flex items-center justify-center transition-all duration-200 min-w-[44px] min-h-[44px]",
  {
    variants: {
      variant: {
        "minimalist-editorial":
          "text-neutral-500 hover:text-neutral-900 border border-neutral-200 rounded-full px-3 py-1.5 text-xs uppercase tracking-widest hover:bg-neutral-100",
        "neo-brutalist":
          "bg-white text-black border-2 border-black px-3 py-1.5 font-bold hover:bg-yellow-300 hover:translate-x-0.5 hover:-translate-y-0.5 shadow-[2px_2px_0_0_black] hover:shadow-[4px_4px_0_0_black]",
        "glass-morphic":
          "bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 hover:text-white hover:bg-white/20 rounded-lg px-3 py-1.5",
        "bento-grid":
          "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl px-3 py-1.5",
        spotlight:
          "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 rounded-lg px-3 py-1.5",
        midnight:
          "bg-amber-900/20 text-amber-200 hover:bg-amber-900/40 border border-amber-700/30 rounded-lg px-3 py-1.5",
        "bold-corporate":
          "bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200 rounded-md px-3 py-1.5 shadow-sm",
        "classic-ats":
          "text-gray-500 hover:text-gray-900 border border-gray-300 rounded px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-gray-100",
        "design-folio":
          "bg-[#1a1a1a] text-[#888] hover:text-[#CCFF00] border border-[#333] hover:border-[#CCFF00] rounded-full px-3 py-1.5 font-mono text-xs uppercase tracking-widest",
        "dev-terminal":
          "bg-[#161b22] text-[#c9d1d9] hover:text-[#58a6ff] border border-[#30363d] rounded px-3 py-1.5",
      },
    },
    defaultVariants: {
      variant: "minimalist-editorial",
    },
  },
);

// WhatsApp SVG icon (Lucide doesn't have it)
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

interface ShareBarProps extends VariantProps<typeof shareBarVariants> {
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
 * Social share bar component
 *
 * Provides share buttons for Twitter, LinkedIn, WhatsApp, and copy link.
 * Uses Web Share API as primary when available, falls back to individual buttons.
 * Theme-adaptive styling via variant prop.
 *
 * @example
 * ```tsx
 * <ShareBar
 *   url="https://webresume.now/john"
 *   title="John Doe's Portfolio"
 *   name="John Doe"
 *   variant="minimalist-editorial"
 * />
 * ```
 */
export function ShareBar({ url, handle, title, name, variant, className }: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  const shareText = generateShareText(name);
  const hasWebShare = isWebShareSupported();

  // Construct URL from handle if not provided (uses @ prefix convention)
  const shareUrl =
    url ||
    (typeof window !== "undefined" && handle
      ? `${window.location.origin}/@${handle}`
      : `https://webresume.now/@${handle ?? ""}`);

  const handleNativeShare = useCallback(async () => {
    try {
      await webShare({ title, text: shareText, url: shareUrl });
    } catch (err) {
      // User cancelled or error - silently ignore
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Share failed:", err);
      }
    }
  }, [title, shareText, shareUrl]);

  const handleTwitterShare = useCallback(() => {
    window.open(generateTwitterShareUrl(shareText, shareUrl), "_blank", "noopener,noreferrer");
  }, [shareText, shareUrl]);

  const handleLinkedInShare = useCallback(() => {
    window.open(generateLinkedInShareUrl(shareUrl), "_blank", "noopener,noreferrer");
  }, [shareUrl]);

  const handleWhatsAppShare = useCallback(() => {
    window.open(generateWhatsAppShareUrl(shareText, shareUrl), "_blank", "noopener,noreferrer");
  }, [shareText, shareUrl]);

  const handleCopyLink = useCallback(async () => {
    try {
      await copyToClipboard(shareUrl);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }, [shareUrl]);

  return (
    <div
      className={cn(shareBarVariants({ variant }), className)}
      role="group"
      aria-label="Share options"
    >
      {/* Native share button (mobile-first) */}
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

      {/* Twitter/X */}
      <button
        type="button"
        onClick={handleTwitterShare}
        className={cn(buttonVariants({ variant }))}
        aria-label="Share on X (Twitter)"
      >
        <XIcon className="size-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only sm:ml-1.5">X</span>
      </button>

      {/* LinkedIn */}
      <button
        type="button"
        onClick={handleLinkedInShare}
        className={cn(buttonVariants({ variant }))}
        aria-label="Share on LinkedIn"
      >
        <LinkedinIcon className="size-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only sm:ml-1.5">LinkedIn</span>
      </button>

      {/* WhatsApp */}
      <button
        type="button"
        onClick={handleWhatsAppShare}
        className={cn(buttonVariants({ variant }))}
        aria-label="Share on WhatsApp"
      >
        <WhatsAppIcon className="size-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only sm:ml-1.5">WhatsApp</span>
      </button>

      {/* Copy Link */}
      <button
        type="button"
        onClick={handleCopyLink}
        className={cn(buttonVariants({ variant }))}
        aria-label={copied ? "Link copied" : "Copy link"}
      >
        {copied ? (
          <Check className="size-4 text-green-500" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        <span className="sr-only sm:not-sr-only sm:ml-1.5">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}

export type { ShareBarProps };
export type ShareBarVariant = NonNullable<VariantProps<typeof shareBarVariants>["variant"]>;
