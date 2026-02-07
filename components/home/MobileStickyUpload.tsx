"use client";

import { useEffect, useState } from "react";
import { FileDropzone } from "@/components/FileDropzone";

/**
 * Mobile-only sticky bottom bar with upload CTA.
 * Auto-hides when the real upload card (#upload-card) is in viewport.
 */
export function MobileStickyUpload() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const target = document.getElementById("upload-card");
    if (!target) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0.1 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        className={`
          fixed bottom-0 left-0 right-0 z-40 lg:hidden
          bg-cream border-t-3 border-ink p-3
          transition-transform duration-300
          ${visible ? "translate-y-0" : "translate-y-full"}
        `}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-ink text-cream font-black w-full py-3 border-3 border-ink shadow-brutal-sm active:shadow-none active:translate-y-0.5 transition-all duration-150"
        >
          Upload Your Resume →
        </button>
      </div>
      <FileDropzone open={open} onOpenChange={setOpen} />
    </>
  );
}
