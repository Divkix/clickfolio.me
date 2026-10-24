"use client";

import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/auth/client";
import type { ThemeChrome } from "@/lib/templates/theme-chrome";
import { cn } from "@/lib/utils/cn";
import { useDismissable } from "@/hooks/useDismissable";

const SHOW_DELAY_MS = 3000;

const SCROLL_THRESHOLD = 0.3;

interface CreateYoursCTAProps {
  handle: string;
  profileId: string;
  styles: ThemeChrome["cta"];
}

export function CreateYoursCTA({ handle, profileId, styles }: CreateYoursCTAProps) {
  const { data: session } = useSession();
  const [visible, setVisible] = useState(false);
  const [dismissed, dismiss] = useDismissable("cta_dismissed", 7 * 24 * 60 * 60 * 1000);

  useEffect(() => {
    if (dismissed) return;

    let timer: ReturnType<typeof setTimeout>;
    let hasTriggered = false;

    const triggerShow = () => {
      if (!hasTriggered) {
        hasTriggered = true;
        setVisible(true);
        window.removeEventListener("scroll", handleScroll);
      }
    };

    timer = setTimeout(triggerShow, SHOW_DELAY_MS);

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
    setVisible(false);
    dismiss();
  }, [dismiss]);

  const isOwnResume = session?.user?.id === profileId;

  if (dismissed || !visible || isOwnResume) {
    return null;
  }

  const ctaUrl = `/?utm_source=resume&utm_medium=cta&utm_campaign=${encodeURIComponent(handle)}`;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-full shadow-lg animate-fade-in-up",
        styles.container,
      )}
    >
      <Sparkles className="size-4 shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium hidden sm:inline">Like this resume?</span>
      <Link
        href={ctaUrl}
        className={cn(
          "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-200",
          styles.button,
        )}
      >
        Create yours free
        <span aria-hidden="true">→</span>
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        className={cn("p-1 rounded-full transition-colors", styles.closeButton)}
        aria-label="Dismiss"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export type { CreateYoursCTAProps };
