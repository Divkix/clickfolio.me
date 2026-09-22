"use client";

import { useState, useSyncExternalStore } from "react";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";

// Visibility of the sticky bar is owned by an IntersectionObserver watching
// #upload-card; the store lives outside React so subscribing syncs without a
// cascading render. A missing card counts as off screen (show the bar).
let uploadCardHidden = false;

function subscribeToUploadCard(onStoreChange: () => void): () => void {
  const target = document.getElementById("upload-card");

  if (!target) return () => {};

  const observer = new IntersectionObserver(
    ([entry]) => {
      uploadCardHidden = !entry.isIntersecting;
      onStoreChange();
    },
    { threshold: 0.1 },
  );

  observer.observe(target);

  return () => observer.disconnect();
}

function getUploadCardHidden(): boolean {
  return document.getElementById("upload-card") === null || uploadCardHidden;
}

function getUploadCardHiddenOnServer(): boolean {
  return false;
}

export function MobileStickyUpload() {
  const [open, setOpen] = useState(false);

  const visible = useSyncExternalStore(
    subscribeToUploadCard,
    getUploadCardHidden,
    getUploadCardHiddenOnServer,
  );

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
