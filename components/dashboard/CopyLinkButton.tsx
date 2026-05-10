"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/utils/clipboard";

interface CopyLinkButtonProps {
  handle: string;
}

export function CopyLinkButton({ handle }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${window.location.origin}/@${handle}`;

    const success = await copyToClipboard(url);

    if (success) {
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Failed to copy link. Please copy manually.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-300",
        copied
          ? "bg-linear-to-r from-emerald-600 to-emerald-700 text-white shadow-sm"
          : "bg-linear-to-r from-coral to-coral hover:from-coral/90 hover:to-coral/90 text-white shadow-sm hover:shadow-md focus:ring-2 focus:ring-coral focus:ring-offset-2",
      )}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          Copied!
        </>
      ) : (
        <>
          <Link2 className="h-4 w-4" />
          Copy Share Link
        </>
      )}
    </button>
  );
}
