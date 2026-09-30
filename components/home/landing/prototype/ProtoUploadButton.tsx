"use client";

// PROTOTYPE (throwaway): UploadCTA without the A/B analytics, so flipping
// variants locally never records `landing_cta_clicked`.

import { useState, type ReactNode } from "react";
import { FileDropzone } from "@/components/FileDropzone";

export function ProtoUploadButton({
  className,
  children,
  onBeforeOpen,
}: {
  className?: string;
  children: ReactNode;
  onBeforeOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          onBeforeOpen?.();
          setOpen(true);
        }}
      >
        {children}
      </button>
      <FileDropzone open={open} onOpenChange={setOpen} />
    </>
  );
}
