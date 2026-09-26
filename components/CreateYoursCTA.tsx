"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/auth/client";
import { cn } from "@/lib/utils/cn";
import { useDismissable } from "@/hooks/useDismissable";

const SHOW_DELAY_MS = 3000;

const SCROLL_THRESHOLD = 0.3;

const ctaVariants = cva(
  "flex items-center gap-3 px-4 py-3 rounded-full shadow-lg animate-fade-in-up",
  {
    variants: {
      variant: {
        minimalist_editorial: "bg-[#1B1B1F] text-white border border-[#1B1B1F]",
        neo_brutalist: "bg-white text-black border-[3px] border-black shadow-[4px_4px_0_0_#000]",
        glass: "bg-[#141A2E]/80 backdrop-blur-md border border-white/15 text-white",
        bento: "bg-[#1F4E3D] text-[#F4F5F1] border border-[#1F4E3D]",
        spotlight: "bg-[#22163A] text-[#E9E7F2] border border-[#22163A]",
        midnight: "bg-[#0F1633] text-[#EDE6D6] border border-[#D4B26A]/30",
        bold_corporate: "bg-[#0E2A47] text-white border border-[#0E2A47]",
        dev_terminal: "bg-[#2d333b] text-[#adbac7] border border-[#444c56]",
        classic_ats: "bg-white text-[#1F2328] border border-[#B9BCC2]",
        design_folio: "bg-[#2D3BFF] text-white border border-[#2D3BFF]",
        case_file: "bg-[#2F2A26] text-[#FBF7EE] border border-[#D9BF83]/40",
        retro_os:
          "bg-[#C0C0C0] text-black rounded-none shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#fff,inset_-2px_-2px_#808080,inset_2px_2px_#dfdfdf]",
      },
    },
    defaultVariants: {
      variant: "minimalist_editorial",
    },
  },
);

const buttonVariants = cva(
  "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-200",
  {
    variants: {
      variant: {
        minimalist_editorial: "bg-white text-[#1B1B1F] hover:bg-[#F4F4F5]",
        neo_brutalist: "bg-[#FFD400] text-black hover:bg-[#FFE14D] font-bold",
        glass: "bg-white/20 text-white hover:bg-white/30",
        bento: "bg-[#F4D35E] text-[#1A1C20] hover:bg-[#F7DD7E]",
        spotlight: "bg-[#FFD95A] text-[#22163A] hover:bg-[#FFE27F]",
        midnight: "bg-[#D4B26A] text-[#0B1026] hover:bg-[#E0C487]",
        bold_corporate: "bg-white text-[#0E2A47] hover:bg-[#EEF2F6]",
        dev_terminal: "bg-[#347d39] text-white hover:bg-[#46954a]",
        classic_ats: "bg-[#22385C] text-white hover:bg-[#2D4874]",
        design_folio: "bg-white text-black hover:bg-[#EDEEF0]",
        case_file: "bg-[#D9BF83] text-[#2F2A26] hover:bg-[#E4CD97]",
        retro_os: "bg-[#000080] text-white rounded-none hover:bg-[#1084D0]",
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
      minimalist_editorial: "hover:bg-white/10 text-white/60",
      neo_brutalist: "hover:bg-black/10 text-black",
      glass: "hover:bg-white/10 text-white/60",
      bento: "hover:bg-white/10 text-[#F4F5F1]/70",
      spotlight: "hover:bg-white/10 text-[#E9E7F2]/70",
      midnight: "hover:bg-[#D4B26A]/15 text-[#D4B26A]",
      bold_corporate: "hover:bg-white/10 text-white/60",
      dev_terminal: "hover:bg-[#444c56] text-[#768390]",
      classic_ats: "hover:bg-gray-100 text-gray-500",
      design_folio: "hover:bg-white/10 text-white/70",
      case_file: "hover:bg-white/10 text-[#FBF7EE]/70",
      retro_os: "hover:bg-black/10 text-black rounded-none",
    },
  },
  defaultVariants: {
    variant: "minimalist_editorial",
  },
});

interface CreateYoursCTAProps extends VariantProps<typeof ctaVariants> {
  handle: string;
  className?: string;
}

export function CreateYoursCTA({ handle, variant, className }: CreateYoursCTAProps) {
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

  // SAFETY: session.user is Better Auth user with additional handle field; cast bridges typed user to optional handle.
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
