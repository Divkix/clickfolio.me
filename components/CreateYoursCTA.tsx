import { Sparkles, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth/client";
import type { ThemeChrome } from "@/lib/templates/theme-chrome";
import { cn } from "@/lib/utils/cn";
import { useDismissable } from "@/hooks/useDismissable";

interface CreateYoursCTAProps {
  handle: string;
  profileId: string;
  styles: ThemeChrome["cta"];
}

export function CreateYoursCTA({ handle, profileId, styles }: CreateYoursCTAProps) {
  const { data: session } = useSession();
  const [visible, setVisible] = useState(false);
  const [dismissed, dismiss] = useDismissable("cta_dismissed", 7 * 24 * 60 * 60 * 1000);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isOwnResume = session?.user?.id === profileId;

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (dismissed || isOwnResume || !sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;

      setVisible(true);
      observer.disconnect();
    });

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [dismissed, isOwnResume]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    dismiss();
  }, [dismiss]);

  return (
    <div ref={sentinelRef} className="flex min-h-px justify-center">
      {visible && !dismissed && !isOwnResume && (
        <div
          className={cn(
            "flex max-w-full flex-wrap items-center justify-center gap-2 px-3 py-2 rounded-2xl sm:rounded-full shadow-lg animate-fade-in-up",
            styles.container,
          )}
        >
          <Sparkles className="size-4 shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium hidden sm:inline">Like this resume?</span>
          <Link
            to="/"
            search={{ utm_source: "resume", utm_medium: "cta", utm_campaign: handle }}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200",
              styles.button,
            )}
          >
            Create yours free
            <span aria-hidden="true">→</span>
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            className={cn(
              "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors",
              styles.closeButton,
            )}
            aria-label="Dismiss résumé promotion"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

export type { CreateYoursCTAProps };
