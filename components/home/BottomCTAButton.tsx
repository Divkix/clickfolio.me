"use client";

import { useState } from "react";
import { FileDropzone } from "@/components/FileDropzone";

/**
 * Bottom CTA button that opens the FileDropzone in a modal dialog.
 * Replaces ScrollToTopButton to provide a direct upload action.
 */
export function BottomCTAButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          inline-block
          bg-ink
          text-cream
          font-black
          text-lg
          px-8
          py-4
          border-3
          border-cream
          shadow-[5px_5px_0px_#eff6ff]
          hover:-translate-x-0.5
          hover:-translate-y-0.5
          hover:shadow-[7px_7px_0px_#eff6ff]
          active:translate-x-0
          active:translate-y-0
          active:shadow-[3px_3px_0px_#eff6ff]
          transition-all
          duration-150
        "
      >
        Upload your resume →
      </button>
      <FileDropzone open={open} onOpenChange={setOpen} />
    </>
  );
}
