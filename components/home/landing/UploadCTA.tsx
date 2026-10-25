import { useState, type ReactNode } from "react";
import { FileDropzone } from "@/components/FileDropzone";
import { trackEvent, type LandingCtaLocation } from "@/lib/telemetry/browser";

interface UploadCTAProps {
  /** Where on the page the button sits, for the `landing_cta_clicked` funnel event. */
  location: LandingCtaLocation;
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
          trackEvent("landing_cta_clicked", { location });
          setOpen(true);
        }}
      >
        {children}
      </button>
      <FileDropzone open={open} onOpenChange={setOpen} />
    </>
  );
}
