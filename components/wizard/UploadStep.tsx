"use client";

import { Loader2, Upload } from "lucide-react";
import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { clearStoredReferralCode, getStoredReferralCode } from "@/lib/referral";
import type { ClaimResponse } from "@/lib/types/api";
import type { ResumeContent } from "@/lib/types/database";
import { MAX_FILE_SIZE_LABEL, validatePDF } from "@/lib/utils/validation";
import { waitForResumeCompletion } from "@/lib/utils/wait-for-completion";

interface UploadStepProps {
  onContinue: (resumeData: ResumeContent) => void;
}

type UploadState = "idle" | "uploading" | "claiming" | "parsing" | "error";

// API Response types
interface UploadResponse {
  key: string;
  remaining: number;
  error?: string;
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

  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    setError(null);

    const validation = validatePDF(selectedFile);
    if (!validation.valid) {
      setError(validation.error!);
      toast.error(validation.error!);
      return;
    }

    setFile(selectedFile);
    void uploadAndParse(selectedFile);
  };

  // Wait for resume parsing completion via WebSocket (with polling fallback)
  const awaitResumeCompletion = async (resumeId: string): Promise<ResumeContent | null> => {
    const result = await waitForResumeCompletion(resumeId);

    if (result.status === "completed") {
      // Fetch the parsed content
      const siteDataResponse = await fetch("/api/site-data");
      if (siteDataResponse.ok) {
        const siteData = (await siteDataResponse.json()) as SiteDataResponse | null;
        if (siteData?.content) {
          return siteData.content;
        }
      }
      return null;
    }

    // Failed
    setError(result.error || "Resume parsing failed. Please try again.");
    setUploadState("error");
    return null;
  };

  const uploadAndParse = async (fileToUpload: File) => {
    setUploadState("uploading");
    setUploadProgress(0);
    setError(null);

    try {
      // Step 1: Upload directly to Worker
      setUploadProgress(10);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(fileToUpload.size),
          "X-Filename": fileToUpload.name,
        },
        body: fileToUpload,
      });

      if (!uploadResponse.ok) {
        const data = (await uploadResponse.json()) as UploadResponse;
        if (uploadResponse.status === 429) {
          throw new Error(data.error || "Too many upload attempts. Please wait and try again.");
        }
        throw new Error(data.error || "Failed to upload file");
      }

      const { key } = (await uploadResponse.json()) as UploadResponse;
      setUploadProgress(40);
      setUploadState("claiming");

      // Step 2: Claim the upload (hash computed server-side)
      // Include referral code if present
      const referralRef = getStoredReferralCode();
      const claimResponse = await fetch("/api/resume/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          referral_code: referralRef || undefined,
        }),
      });

      if (!claimResponse.ok) {
        const data = (await claimResponse.json()) as ClaimResponse;
        throw new Error(data.error || "Failed to claim resume");
      }

      const claimData = (await claimResponse.json()) as ClaimResponse;
      const resumeId = claimData.resume_id;
      const cached = claimData.cached;
      setUploadProgress(70);
      setUploadState("parsing");

      // Step 3: If cached, we already have the content; otherwise poll for status
      if (cached) {
        // Fetch site_data directly since it's already populated
        const siteDataResponse = await fetch("/api/site-data");
        if (siteDataResponse.ok) {
          const siteData = (await siteDataResponse.json()) as SiteDataResponse | null;
          if (siteData?.content) {
            setUploadProgress(100);
            clearStoredReferralCode();
            toast.success("Resume parsed successfully!");
            onContinue(siteData.content);
            return;
          }
        }
        throw new Error("Failed to load cached resume data");
      }

      // Wait for parsing completion via WebSocket (with polling fallback)
      const parsingResult = await awaitResumeCompletion(resumeId);

      if (parsingResult) {
        setUploadProgress(100);
        clearStoredReferralCode();
        toast.success("Resume parsed successfully!");
        onContinue(parsingResult);
      }
    } catch (err) {
      let errorMessage = "Failed to process resume";

      if (err instanceof Error) {
        if (err.message.includes("429") || err.message.includes("limit")) {
          errorMessage = "Upload limit reached (5 per day). Try again tomorrow.";
        } else if (err.message.includes("413") || err.message.includes("large")) {
          errorMessage = `File too large. Maximum size is ${MAX_FILE_SIZE_LABEL}.`;
        } else if (err.message.includes("401") || err.message.includes("expired")) {
          errorMessage = "Session expired. Please refresh the page.";
        } else if (err.message) {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      setUploadState("error");
      toast.error(errorMessage);
    }
  };

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
              <p className="text-sm text-muted-foreground">
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
