"use client";

import { Copy, Gift, MousePointerClick, Share2, Users } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/utils/share";

interface ReferralStatsProps {
  /** Number of users who signed up via this user's referral link */
  referralCount: number;
  /** Number of clicks on the referral link */
  clickCount: number;
  /** The user's referral code for generating the referral link */
  referralCode: string;
}

/**
 * Horizontal referral CTA card for dashboard left column
 *
 * Features:
 * - Benefit-focused copy ("Share Clickfolio")
 * - Click and conversion stats
 * - Prominent copy button with focus ring
 */
export function ReferralStats({ referralCount, clickCount, referralCode }: ReferralStatsProps) {
  const [copied, setCopied] = useState(false);

  const referralUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${referralCode}`
      : `https://clickfolio.me/?ref=${referralCode}`;

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

  // Calculate conversion rate
  const conversionRate = clickCount > 0 ? Math.round((referralCount / clickCount) * 100) : 0;

  return (
    <div className="bg-linear-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-200/60 p-6 shadow-depth-sm hover:shadow-depth-md transition-shadow duration-300">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-5 h-5 text-purple-600" aria-hidden="true" />
              <h3 className="font-semibold text-slate-900">Share Clickfolio</h3>
            </div>
            <p className="text-sm text-slate-600">
              Know someone who needs a portfolio? Share your link.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-white/80 px-3 py-2 rounded-lg text-sm font-mono text-slate-600 hidden sm:block">
              clickfolio.me/?ref={referralCode}
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

        {/* Stats Row - Only show if there's activity */}
        {(clickCount > 0 || referralCount > 0) && (
          <div className="flex items-center gap-6 pt-2 border-t border-purple-200/40">
            <div className="flex items-center gap-2">
              <MousePointerClick className="w-4 h-4 text-purple-500" aria-hidden="true" />
              <span className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{clickCount}</span>{" "}
                {clickCount === 1 ? "click" : "clicks"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" aria-hidden="true" />
              <span className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{referralCount}</span>{" "}
                {referralCount === 1 ? "signup" : "signups"}
              </span>
            </div>
            {clickCount > 0 && (
              <span className="text-xs text-purple-600 font-medium">
                {conversionRate}% conversion
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export type { ReferralStatsProps };
