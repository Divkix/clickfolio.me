"use client";

import { Check, Copy, ExternalLink, Rocket, XIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copyToClipboard, generateTwitterShareUrl } from "@/lib/utils/share";

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

  const resumeUrl =
    url ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/${handle}`
      : `https://webresume.now/${handle}`);

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

  const handleTwitterShare = useCallback(() => {
    const shareText = "Just published my professional resume! Check it out:";
    window.open(generateTwitterShareUrl(shareText, resumeUrl), "_blank", "noopener,noreferrer");
  }, [resumeUrl]);

  return (
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
            <code className="flex-1 text-sm truncate font-mono">webresume.now/{handle}</code>
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

          {/* Share Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1" onClick={handleTwitterShare}>
              <XIcon className="size-4 mr-2" />
              Share on X
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleCopyLink}>
              <Copy className="size-4 mr-2" />
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </div>

          {/* View Resume Link */}
          <Link
            href={`/${handle}`}
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            onClick={() => onOpenChange(false)}
          >
            View My Resume
            <ExternalLink className="size-4" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { YouAreLiveModalProps };
