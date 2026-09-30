"use client";

import { useState, type ReactNode } from "react";
import { FileDropzone } from "@/components/FileDropzone";
import { isAnalyticsInitialized, trackAnalyticsEvent } from "@/lib/analytics/client";

interface UploadCTAProps {
  /** Where on the page the button sits, e.g. "hero" or "footer_cta". */
  location: string;
  className?: string;
  children: ReactNode;
  /** Runs before the upload modal opens (e.g. persist a typed handle). */
  onBeforeOpen?: () => void;
}

export function UploadCTA({ location, className, children, onBeforeOpen }: UploadCTAProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          onBeforeOpen?.();

          if (isAnalyticsInitialized()) {
            trackAnalyticsEvent("landing_cta_clicked", { location });
          }

          setOpen(true);
        }}
      >
        {children}
      </button>
      <FileDropzone open={open} onOpenChange={setOpen} />
    </>
  );
}
