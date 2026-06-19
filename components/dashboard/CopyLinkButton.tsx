"use client";

import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

interface CopyLinkButtonProps {
  handle: string;
}

export function CopyLinkButton({ handle }: CopyLinkButtonProps) {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = async () => {
    const url = `${window.location.origin}/@${handle}`;

    await copy(url, {
      successMessage: "Link copied to clipboard!",
      errorMessage: "Failed to copy link. Please copy manually.",
    });
  };

  return (
    <Button type="button" onClick={handleCopy} size="sm" variant={copied ? "secondary" : "default"}>
      {copied ? (
        <>
          <Check className="h-4 w-4" aria-hidden="true" />
          Copied!
        </>
      ) : (
        <>
          <Link2 className="h-4 w-4" aria-hidden="true" />
          Copy Share Link
        </>
      )}
    </Button>
  );
}
