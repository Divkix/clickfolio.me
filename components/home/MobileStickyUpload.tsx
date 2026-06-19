"use client";

import { useEffect, useState } from "react";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";

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
        className={`fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/90 p-3 backdrop-blur-md transition-transform duration-300 lg:hidden ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <Button type="button" size="lg" className="w-full" onClick={() => setOpen(true)}>
          Upload your resume
        </Button>
      </div>
      <FileDropzone open={open} onOpenChange={setOpen} />
    </>
  );
}
