"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/utils/clipboard";

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
