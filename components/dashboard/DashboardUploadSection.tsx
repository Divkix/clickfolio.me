"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/FileDropzone";
import { Upload } from "lucide-react";

export function DashboardUploadSection() {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setUploadModalOpen(true)}
        variant="outline"
        className="flex-1 border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 font-semibold transition-all duration-300 shadow-depth-sm hover:shadow-depth-md"
      >
        <Upload className="h-4 w-4 mr-2" />
        Upload New Resume
      </Button>

      <FileDropzone open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
    </>
  );
}
