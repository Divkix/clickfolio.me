"use client";

import { Check, Copy, ExternalLink, Rocket, XIcon } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { Confetti } from "@/components/Confetti";
import { LinkedInIcon, WhatsAppIcon } from "@/components/icons/BrandIcons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import {
  generateLinkedInShareUrl,
  generateTwitterShareUrl,
  generateWhatsAppShareUrl,
} from "@/lib/utils/share";

interface YouAreLiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handle: string;
  url?: string;
}

export function YouAreLiveModal({ open, onOpenChange, handle, url }: YouAreLiveModalProps) {
  const { copied, copy } = useCopyToClipboard();

  const resumeUrl =
    url ||
    (globalThis.window !== undefined
      ? `${globalThis.window.location.origin}/@${handle}`
      : `https://clickfolio.me/@${handle}`);

  const shareText = "Just published my professional resume! Check it out:";

  const handleCopyLink = useCallback(async () => {
    await copy(resumeUrl, {
      successMessage: "Link copied!",
      errorMessage: "Failed to copy link",
    });
  }, [resumeUrl, copy]);

  const handleTwitterShare = useCallback(() => {
    window.open(generateTwitterShareUrl(shareText, resumeUrl), "_blank", "noopener,noreferrer");
  }, [resumeUrl]);

  const handleLinkedInShare = useCallback(() => {
    window.open(generateLinkedInShareUrl(resumeUrl), "_blank", "noopener,noreferrer");
  }, [resumeUrl]);

  const handleWhatsAppShare = useCallback(() => {
    window.open(generateWhatsAppShareUrl(shareText, resumeUrl), "_blank", "noopener,noreferrer");
  }, [resumeUrl]);

  return (
    <>
      {open && <Confetti />}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader className="items-center">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
              <Rocket className="size-8 text-success" />
            </div>
            <DialogTitle className="text-2xl">You&apos;re Live!</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-muted-foreground">
              Your resume is now published and ready to share with the world.
            </p>

            <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
              <code className="flex-1 text-sm truncate font-mono">clickfolio.me/@{handle}</code>
              <button
                type="button"
                onClick={handleCopyLink}
                className="p-2 hover:bg-background rounded-md transition-colors"
                aria-label={copied ? "Link copied" : "Copy link"}
              >
                {copied ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <Copy className="size-4 text-muted-foreground" />
                )}
              </button>
            </div>

            <Button className="w-full" onClick={handleLinkedInShare}>
              <LinkedInIcon variant="white" className="size-5 mr-2" aria-hidden={true} />
              Share on LinkedIn
            </Button>

            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={handleTwitterShare}>
                <XIcon className="size-4 mr-1" />
                Twitter
              </Button>
              <Button variant="outline" size="sm" onClick={handleWhatsAppShare}>
                <WhatsAppIcon className="size-4 mr-1" />
                WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                <Copy className="size-4 mr-1" />
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>

            <div className="border-t border-border pt-4 mt-4 text-sm text-muted-foreground text-left">
              <p className="font-semibold text-foreground mb-2">What to do next:</p>
              <ul className="space-y-1">
                <li>&#10003; Add your link to your LinkedIn profile</li>
                <li>&#10003; Update your email signature</li>
                <li>&#10003; Share in job hunting communities</li>
              </ul>
            </div>

            <Link
              href={`/@${handle}`}
              className="inline-flex items-center gap-2 text-brand hover:underline font-medium"
              onClick={() => onOpenChange(false)}
            >
              View My Resume
              <ExternalLink className="size-4" />
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type { YouAreLiveModalProps };
