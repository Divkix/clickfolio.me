"use client";

import { Loader2, Upload } from "lucide-react";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useFileUpload } from "@/hooks/useFileUpload";
import type { ResumeContent } from "@/lib/types/database";
import { MAX_FILE_SIZE_LABEL } from "@/lib/utils/validation";
import { waitForResumeCompletion } from "@/lib/utils/wait-for-completion";

interface UploadStepProps {
  onContinue: (resumeData: ResumeContent) => void;
}

interface SiteDataResponse {
  content?: ResumeContent;
}

/**
 * Step 0: Upload Resume Component
 * Allows users who logged in without uploading to upload their resume
 */
export function UploadStep({ onContinue }: UploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ponytail: onClaim ref avoids circular dep between hook setters and handler
  const onClaimRef = useRef<(resumeId: string) => void>(() => {});

  const {
    file,
    uploadProgress,
    uploadState,
    error,
    isDragging,
    setUploadProgress,
    setUploadState,
    setError,
    setFile,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
  } = useFileUpload({ onClaim: (resumeId) => onClaimRef.current(resumeId) });

  const awaitResumeCompletion = useCallback(
    async (resumeId: string): Promise<ResumeContent | null> => {
      const result = await waitForResumeCompletion(resumeId);
      if (result.status === "completed") {
        const siteDataResponse = await fetch("/api/site-data");
        if (siteDataResponse.ok) {
          // SAFETY: /api/site-data returns bounded SiteDataResponse JSON
          const siteData = (await siteDataResponse.json()) as SiteDataResponse | null;
          if (siteData?.content) {
            return siteData.content;
          }
        }
        throw new Error(
          "Your resume was parsed, but we couldn't load the result. Please try again.",
        );
      }

      setError(result.error || "Resume parsing failed. Please try again.");
      setUploadState("error");
      return null;
    },
    [setError, setUploadState],
  );

  // SAFETY: onClaimRef expects (resumeId:string)=>void; async handler returns Promise<void> intentionally ignored (caller does not await)
  onClaimRef.current = useCallback(
    async (resumeId: string) => {
      try {
        const parsingResult = await awaitResumeCompletion(resumeId);

        if (parsingResult) {
          setUploadProgress(100);
          toast.success("Resume parsed successfully!");
          onContinue(parsingResult);
        }
      } catch (err) {
        const msg = err instanceof Error && err.message ? err.message : "Failed to process resume";
        setError(msg);
        setUploadState("error");
        toast.error(msg);
      }
    },
    [awaitResumeCompletion, onContinue, setError, setUploadProgress, setUploadState],
  ) as (resumeId: string) => void;

  const handleRetry = () => {
    setError(null);
    setUploadState("idle");
    setUploadProgress(0);
    setFile(null);
  };

  const isProcessing = uploadState !== "idle" && uploadState !== "error";

  const getProgressMessage = (): string => {
    switch (uploadState) {
      case "uploading":
        return "Uploading your resume...";
      case "claiming":
        return "Preparing for AI parsing...";
      case "parsing":
        return "AI is extracting your experience...";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-brand-subtle rounded-xl flex items-center justify-center mb-6">
          <Upload className="w-8 h-8 text-brand" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 leading-tight">
          Upload Your Resume
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Drop your PDF to get started. We&apos;ll extract your experience in seconds.
        </p>
      </div>

      {/* Upload Zone */}
      <div className="max-w-md mx-auto space-y-4">
        {uploadState === "error" ? (
          /* Error State */
          <div className="bg-card rounded-xl border border-border p-8 text-center shadow-sm">
            <div className="mx-auto w-16 h-16 mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-destructive"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  stroke="currentColor"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>

            <h3 className="text-lg font-bold text-foreground mb-2">Something Went Wrong</h3>
            <p className="text-sm text-destructive mb-6">{error}</p>

            <Button onClick={handleRetry} className="w-full" size="lg">
              Try Again
            </Button>
          </div>
        ) : isProcessing ? (
          /* Processing State */
          <div className="bg-card rounded-xl border border-border p-8 text-center shadow-sm">
            <div className="mx-auto w-16 h-16 mb-4 bg-brand-subtle rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-brand animate-spin" />
            </div>

            <h3 className="text-lg font-bold text-foreground mb-2">
              {uploadState === "parsing" ? "AI Parsing Your Resume" : "Processing..."}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{getProgressMessage()}</p>

            {uploadState === "parsing" && (
              <p className="text-xs text-muted-foreground font-medium mb-4">
                This typically takes ~30 seconds
              </p>
            )}

            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2 font-medium">{uploadProgress}%</p>
          </div>
        ) : (
          /* Idle State - Drop Zone */
          <button
            type="button"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Drop your PDF resume here or click to browse files"
            className={`
              group relative w-full bg-card rounded-xl border border-dashed border-border-strong p-12 cursor-pointer transition-colors
              ${
                isDragging
                  ? "border-brand bg-brand-subtle"
                  : "hover:border-border-strong hover:bg-surface-2"
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
              tabIndex={-1}
              aria-label="Upload PDF file"
            />

            <div className="relative z-10 flex flex-col items-center gap-4">
              {/* Icon */}
              <div
                className={`p-4 rounded-xl transition-colors ${isDragging ? "bg-brand text-brand-foreground" : "bg-brand-subtle text-brand"}`}
              >
                <Upload className="w-12 h-12" aria-hidden="true" />
              </div>

              {/* Title text */}
              <p className="text-lg font-semibold text-foreground">
                {file ? file.name : "Drop your PDF resume here"}
              </p>

              {/* Secondary text */}
              <p className="text-sm text-foreground/80">
                or click to browse - Max {MAX_FILE_SIZE_LABEL}
              </p>
            </div>
          </button>
        )}

        {/* Help Text */}
        {uploadState === "idle" && (
          <div className="bg-surface-2 border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-foreground mb-2">Supported formats:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>* PDF files only</li>
              <li>* Maximum file size: {MAX_FILE_SIZE_LABEL}</li>
              <li>* Best results with text-based PDFs (not scanned images)</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
