"use client";

import { Copy, Share2, Users } from "lucide-react";
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
 * Display referral stats and share referral link
 *
 * Shows:
 * - How many people signed up via referral link
 * - Button to copy referral link
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
    <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6 hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-start gap-3 mb-4">
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-linear-to-r from-purple-500 to-pink-500 rounded-xl blur-lg opacity-20" />
          <div className="relative bg-linear-to-r from-purple-100 to-pink-100 p-2 rounded-xl">
            <Users className="w-5 h-5 text-purple-600" aria-hidden="true" />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900">Referrals</h3>
          <p className="text-sm text-slate-500">
            {referralCount > 0
              ? `${referralCount} ${referralCount === 1 ? "person" : "people"} signed up via your link`
              : "Share your link to invite others"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-600 truncate font-mono">
          webresume.now/?ref={handle}
        </div>
        <Button variant="outline" size="sm" onClick={handleCopyLink} className="shrink-0">
          {copied ? (
            <>
              <Share2 className="w-4 h-4 mr-1" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-1" />
              Copy
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export type { ReferralStatsProps };
