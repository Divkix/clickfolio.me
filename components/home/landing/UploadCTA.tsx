"use client";

import { useState, type ReactNode } from "react";
import { FileDropzone } from "@/components/FileDropzone";

interface UploadCTAProps {
  className?: string;
  children: ReactNode;
  /** Runs before the upload modal opens (e.g. persist a typed handle). */
  onBeforeOpen?: () => void;
}

export function UploadCTA({ className, children, onBeforeOpen }: UploadCTAProps) {
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
