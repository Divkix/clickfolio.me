"use client";

import { Check, Copy, ExternalLink, Gift, Rocket, XIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Confetti } from "@/components/Confetti";
import { LinkedInIcon, WhatsAppIcon } from "@/components/icons/BrandIcons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copyToClipboard } from "@/lib/utils/clipboard";
import {
  generateLinkedInShareUrl,
  generateTwitterShareUrl,
  generateWhatsAppShareUrl,
} from "@/lib/utils/share";

interface YouAreLiveModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** The user's handle */
  handle: string;
  /** The full URL to the user's resume (optional, will be constructed if not provided) */
  url?: string;
}

/**
 * "You're Live!" celebration modal
 *
 * Shown after wizard completion to celebrate and encourage sharing.
 *
 * @example
 * ```tsx
 * <YouAreLiveModal
 *   open={showModal}
 *   onOpenChange={setShowModal}
 *   handle="john"
 * />
 * ```
 */
export function YouAreLiveModal({ open, onOpenChange, handle, url }: YouAreLiveModalProps) {
  const [copied, setCopied] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);

  const resumeUrl =
    url ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/@${handle}`
      : `https://clickfolio.me/@${handle}`);

  const referralUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${handle}`
      : `https://clickfolio.me/?ref=${handle}`;

  const shareText = "Just published my professional resume! Check it out:";

  const handleCopyLink = useCallback(async () => {
    try {
      await copyToClipboard(resumeUrl);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }, [resumeUrl]);

  const handleCopyReferralLink = useCallback(async () => {
    try {
      await copyToClipboard(referralUrl);
      setReferralCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setReferralCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }, [referralUrl]);

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
      {/* Celebration confetti when modal opens */}
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

            {/* Resume URL */}
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

            {/* Primary CTA: LinkedIn */}
            <Button className="w-full" onClick={handleLinkedInShare}>
              <LinkedInIcon variant="white" className="size-5 mr-2" aria-hidden={true} />
              Share on LinkedIn
            </Button>

            {/* Secondary share options */}
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

            {/* Next Steps */}
            <div className="border-t border-border pt-4 mt-4 text-sm text-muted-foreground text-left">
              <p className="font-semibold text-foreground mb-2">What to do next:</p>
              <ul className="space-y-1">
                <li>&#10003; Add your link to your LinkedIn profile</li>
                <li>&#10003; Update your email signature</li>
                <li>&#10003; Share in job hunting communities</li>
              </ul>
            </div>

            {/* Referral Section */}
            <div className="bg-brand-subtle rounded-lg p-4 border border-brand/20">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="size-4 text-brand" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">Share with friends</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Know someone job hunting? Share your referral link.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-card px-2 py-1.5 rounded font-mono text-muted-foreground truncate">
                  ?ref={handle}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={referralCopied ? "Referral link copied" : "Copy referral link"}
                  onClick={handleCopyReferralLink}
                  className="shrink-0"
                >
                  {referralCopied ? (
                    <Check className="size-3 text-success" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>
              </div>
            </div>

            {/* View Resume Link */}
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
