"use client";

import { useState } from "react";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";

export function BottomCTAButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="lg" onClick={() => setOpen(true)}>
        Upload your resume
      </Button>
      <FileDropzone open={open} onOpenChange={setOpen} />
    </>
  );
}
