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
  className = "flex-1 border-coral/40 text-coral hover:bg-coral/10 hover:border-coral/40 font-semibold transition-all duration-300 shadow-sm hover:shadow-md",
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
