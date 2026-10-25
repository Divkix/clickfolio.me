import { useCallback, useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/utils/clipboard";

// sonner loads after the first copy, so public profile share bars don't ship it up front.
async function notify(kind: "success" | "error", message: string): Promise<void> {
  const { toast } = await import("sonner");
  toast[kind](message);
}

interface CopyOptions {
  successMessage: string;
  errorMessage: string;
  onSuccess?: () => void;
}

interface UseCopyToClipboardReturn {
  copied: boolean;
  copy: (text: string, opts: CopyOptions) => Promise<void>;
}

export function useCopyToClipboard(): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copy = useCallback(async (text: string, opts: CopyOptions) => {
    try {
      const success = await copyToClipboard(text);

      if (!success) {
        await notify("error", opts.errorMessage);

        return;
      }

      setCopied(true);
      await notify("success", opts.successMessage);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
      opts.onSuccess?.();
    } catch {
      await notify("error", opts.errorMessage);
    }
  }, []);

  return { copied, copy };
}
