"use client";

import { Upload } from "lucide-react";
import { useState } from "react";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";

interface DashboardUploadSectionProps {
  variant?: "outline" | "default";
  className?: string;
  children?: React.ReactNode;
}

export function DashboardUploadSection({
  variant = "outline",
  className = "flex-1",
  children,
}: DashboardUploadSectionProps) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setUploadModalOpen(true)} variant={variant} className={className}>
        {children ?? (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Upload New Resume
          </>
        )}
      </Button>

      <FileDropzone open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
    </>
  );
}
