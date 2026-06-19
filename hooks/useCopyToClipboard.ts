"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/utils/clipboard";

interface CopyOptions {
  /** Toast message shown on a successful copy */
  successMessage: string;
  /** Toast message shown when the copy fails */
  errorMessage: string;
  /** Optional callback invoked only after a successful copy */
  onSuccess?: () => void;
}

interface UseCopyToClipboardReturn {
  /** True for 2 seconds after a successful copy */
  copied: boolean;
  /** Copies text, fires the matching toast, and toggles `copied` on success */
  copy: (text: string, opts: CopyOptions) => Promise<void>;
}

/**
 * Copy-to-clipboard with feedback.
 *
 * Calls {@link copyToClipboard} and treats both a thrown error and a falsy
 * return value as failure. On success it sets `copied` true for 2 seconds,
 * shows the success toast, and runs the optional `onSuccess` callback. On
 * failure it shows the error toast.
 *
 * @returns `{ copied, copy }`
 */
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
        toast.error(opts.errorMessage);
        return;
      }
      setCopied(true);
      toast.success(opts.successMessage);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
      opts.onSuccess?.();
    } catch {
      toast.error(opts.errorMessage);
    }
  }, []);

  return { copied, copy };
}
