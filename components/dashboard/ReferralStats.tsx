"use client";

import { Copy, Gift, Share2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/utils/share";

interface ReferralStatsProps {
  /** Number of users who signed up via this user's referral link */
  referralCount: number;
  /** The user's handle for generating the referral link */
  handle: string;
}

/**
 * Horizontal referral CTA card for dashboard left column
 *
 * Features:
 * - Benefit-focused copy ("Help friends land jobs")
 * - Visible referral count when > 0
 * - Prominent copy button with focus ring
 */
export function ReferralStats({ referralCount, handle }: ReferralStatsProps) {
  const [copied, setCopied] = useState(false);

  const referralUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${handle}`
      : `https://webresume.now/?ref=${handle}`;

  const handleCopyLink = useCallback(async () => {
    try {
      await copyToClipboard(referralUrl);
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }, [referralUrl]);

  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-200/60 p-6 shadow-depth-sm hover:shadow-depth-md transition-shadow duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="w-5 h-5 text-purple-600" aria-hidden="true" />
            <h3 className="font-semibold text-slate-900">Help friends land jobs</h3>
          </div>
          <p className="text-sm text-slate-600">
            Know someone job hunting? Share webresume.now with them.
          </p>
          {referralCount > 0 && (
            <p className="text-xs text-purple-600 font-medium mt-1">
              {referralCount} {referralCount === 1 ? "person" : "people"} joined via your link
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <code className="bg-white/80 px-3 py-2 rounded-lg text-sm font-mono text-slate-600 hidden sm:block">
            webresume.now/?ref={handle}
          </code>
          <Button
            variant="default"
            onClick={handleCopyLink}
            className="shrink-0 bg-purple-600 hover:bg-purple-700 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
          >
            {copied ? (
              <>
                <Share2 className="w-4 h-4 mr-2" aria-hidden="true" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" aria-hidden="true" />
                Copy Link
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export type { ReferralStatsProps };
