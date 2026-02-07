"use client";

import { Check, Copy, ExternalLink, Gift, Rocket, XIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Confetti } from "@/components/Confetti";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copyToClipboard } from "@/lib/utils/clipboard";
import {
  generateLinkedInShareUrl,
  generateTwitterShareUrl,
  generateWhatsAppShareUrl,
} from "@/lib/utils/share";

// Custom SVG icons (brand icons deprecated in Lucide)
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

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
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <Rocket className="size-8 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-2xl">You&apos;re Live!</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-muted-foreground">
              Your resume is now published and ready to share with the world.
            </p>

            {/* Resume URL */}
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <code className="flex-1 text-sm truncate font-mono">clickfolio.me/@{handle}</code>
              <button
                type="button"
                onClick={handleCopyLink}
                className="p-2 hover:bg-background rounded-md transition-colors"
                aria-label={copied ? "Link copied" : "Copy link"}
              >
                {copied ? (
                  <Check className="size-4 text-green-500" />
                ) : (
                  <Copy className="size-4 text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Primary CTA: LinkedIn */}
            <Button
              className="w-full bg-[#0077B5] hover:bg-[#006399] text-white"
              onClick={handleLinkedInShare}
            >
              <LinkedInIcon className="size-5 mr-2" />
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
            <div className="border-t pt-4 mt-4 text-sm text-muted-foreground text-left">
              <p className="font-semibold text-foreground mb-2">What to do next:</p>
              <ul className="space-y-1">
                <li>&#10003; Add your link to your LinkedIn profile</li>
                <li>&#10003; Update your email signature</li>
                <li>&#10003; Share in job hunting communities</li>
              </ul>
            </div>

            {/* Referral Section */}
            <div className="bg-linear-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200/60 dark:border-purple-700/40">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="size-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">Share with friends</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Know someone job hunting? Share your referral link.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white/80 dark:bg-ink/80 px-2 py-1.5 rounded font-mono text-muted-foreground truncate">
                  ?ref={handle}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyReferralLink}
                  className="shrink-0"
                >
                  {referralCopied ? (
                    <Check className="size-3 text-green-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>
              </div>
            </div>

            {/* View Resume Link */}
            <Link
              href={`/@${handle}`}
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
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
