"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "cta_dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SHOW_DELAY_MS = 3000; // 3 seconds
const SCROLL_THRESHOLD = 0.3; // 30% of page

const ctaVariants = cva(
  "fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 rounded-full shadow-lg animate-fade-in-up",
  {
    variants: {
      variant: {
        minimalist_editorial: "bg-neutral-900 text-white border border-neutral-800",
        neo_brutalist: "bg-yellow-300 text-black border-2 border-black shadow-[4px_4px_0_0_black]",
        glass_morphic: "bg-white/10 backdrop-blur-md border border-white/20 text-white",
        bento_grid:
          "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700",
        spotlight: "bg-gradient-to-r from-orange-500 to-amber-500 text-white",
        midnight: "bg-neutral-900 text-amber-200 border border-amber-700/30",
        bold_corporate: "bg-white text-neutral-900 border border-neutral-200 shadow-lg",
      },
    },
    defaultVariants: {
      variant: "minimalist_editorial",
    },
  },
);

const buttonVariants = cva(
  "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
  {
    variants: {
      variant: {
        minimalist_editorial: "bg-white text-neutral-900 hover:bg-neutral-100",
        neo_brutalist: "bg-black text-yellow-300 hover:bg-neutral-900 font-bold",
        glass_morphic: "bg-white/20 text-white hover:bg-white/30",
        bento_grid:
          "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90",
        spotlight: "bg-white text-orange-600 hover:bg-orange-50",
        midnight: "bg-amber-500 text-neutral-900 hover:bg-amber-400",
        bold_corporate: "bg-neutral-900 text-white hover:bg-neutral-800",
      },
    },
    defaultVariants: {
      variant: "minimalist_editorial",
    },
  },
);

const closeButtonVariants = cva("p-1 rounded-full transition-colors", {
  variants: {
    variant: {
      minimalist_editorial: "hover:bg-white/10 text-neutral-400",
      neo_brutalist: "hover:bg-black/10 text-black",
      glass_morphic: "hover:bg-white/10 text-white/60",
      bento_grid: "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500",
      spotlight: "hover:bg-white/10 text-white/80",
      midnight: "hover:bg-amber-900/30 text-amber-400",
      bold_corporate: "hover:bg-neutral-100 text-neutral-400",
    },
  },
  defaultVariants: {
    variant: "minimalist_editorial",
  },
});

interface CreateYoursCTAProps extends VariantProps<typeof ctaVariants> {
  /** The handle of the profile being viewed (for UTM tracking) */
  handle: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * "Create yours" CTA component for public resume pages
 *
 * Shows a floating CTA prompting visitors to create their own resume.
 * - Appears after 3s delay OR 30% scroll (whichever first)
 * - Can be dismissed (persists for 7 days)
 * - Hidden when viewing own resume
 * - Theme-adaptive via variant prop
 *
 * @example
 * ```tsx
 * <CreateYoursCTA handle="john" variant="minimalist_editorial" />
 * ```
 */
export function CreateYoursCTA({ handle, variant, className }: CreateYoursCTAProps) {
  const { data: session } = useSession();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(true); // Default hidden until we check

  // Check dismissal status on mount
  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - Number.parseInt(dismissedAt, 10);
      if (elapsed < DISMISS_DURATION_MS) {
        setDismissed(true);
        return;
      }
      // Expired, clear it
      localStorage.removeItem(DISMISS_KEY);
    }
    setDismissed(false);
  }, []);

  // Visibility triggers: timer and scroll
  useEffect(() => {
    if (dismissed) return;

    let timer: ReturnType<typeof setTimeout>;
    let hasTriggered = false;

    const triggerShow = () => {
      if (!hasTriggered) {
        hasTriggered = true;
        setVisible(true);
        // Clean up scroll listener
        window.removeEventListener("scroll", handleScroll);
      }
    };

    // Timer trigger (3s)
    timer = setTimeout(triggerShow, SHOW_DELAY_MS);

    // Scroll trigger (30%)
    const handleScroll = () => {
      const scrolled = window.scrollY / (document.body.scrollHeight - window.innerHeight);
      if (scrolled >= SCROLL_THRESHOLD) {
        triggerShow();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [dismissed]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
    setDismissed(true);
  }, []);

  // Hide if:
  // - Still checking dismissal
  // - Dismissed
  // - Not yet visible
  // - User viewing their own resume
  // Cast to include handle from Better Auth additional fields
  const userHandle = (session?.user as { handle?: string } | undefined)?.handle;
  const isOwnResume = userHandle === handle;
  if (dismissed || !visible || isOwnResume) {
    return null;
  }

  const ctaUrl = `/?utm_source=resume&utm_medium=cta&utm_campaign=${encodeURIComponent(handle)}`;

  return (
    <div className={cn(ctaVariants({ variant }), className)}>
      <Sparkles className="size-4 shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium hidden sm:inline">Like this resume?</span>
      <Link href={ctaUrl} className={cn(buttonVariants({ variant }))}>
        Create yours free
        <span aria-hidden="true">→</span>
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        className={cn(closeButtonVariants({ variant }))}
        aria-label="Dismiss"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export type { CreateYoursCTAProps };
export type CreateYoursCTAVariant = NonNullable<VariantProps<typeof ctaVariants>["variant"]>;
