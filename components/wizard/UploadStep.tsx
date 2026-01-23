"use client";

import { Loader2, Upload } from "lucide-react";
import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ResumeContent } from "@/lib/types/database";
import { validatePDF } from "@/lib/utils/validation";

interface UploadStepProps {
  onContinue: (resumeData: ResumeContent) => void;
}

type UploadState = "idle" | "uploading" | "claiming" | "parsing" | "error";

// API Response types
interface UploadResponse {
  key: string;
  file_hash: string;
  remaining: number;
  error?: string;
  message?: string;
}

interface ResumeStatusResponse {
  status: "pending_claim" | "processing" | "completed" | "failed";
  error?: string | null;
}

interface ClaimResponse {
  resume_id: string;
  cached?: boolean;
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
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
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
    uploadAndParse(selectedFile);
  };

  // Poll for resume status
  const pollResumeStatus = async (resumeId: string): Promise<ResumeContent | null> => {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 30; // 30 * 3 seconds = 90 seconds max

      const checkStatus = async () => {
        try {
          const response = await fetch(`/api/resume/status?resume_id=${resumeId}`);
          if (!response.ok) {
            throw new Error("Failed to check status");
          }

          const data = (await response.json()) as ResumeStatusResponse;

          if (data.status === "completed") {
            // Clear polling interval
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }

            // Fetch the parsed content
            const siteDataResponse = await fetch("/api/site-data");
            if (siteDataResponse.ok) {
              const siteData = (await siteDataResponse.json()) as SiteDataResponse | null;
              if (siteData?.content) {
                resolve(siteData.content);
                return;
              }
            }
            resolve(null);
            return;
          }

          if (data.status === "failed") {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setError(data.error || "Resume parsing failed. Please try again.");
            setUploadState("error");
            resolve(null);
            return;
          }

          attempts++;
          if (attempts >= maxAttempts) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setError("Parsing is taking longer than expected. Please wait or try again.");
            setUploadState("error");
            resolve(null);
          }
        } catch (err) {
          console.error("Error polling status:", err);
          attempts++;
          if (attempts >= maxAttempts) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setError("Failed to check parsing status. Please try again.");
            setUploadState("error");
            resolve(null);
          }
        }
      };

      // Start polling every 3 seconds
      pollingIntervalRef.current = setInterval(checkStatus, 3000);
      // Check immediately as well
      checkStatus();
    });
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
          throw new Error(data.message || "Too many upload attempts. Please wait and try again.");
        }
        throw new Error(data.error || "Failed to upload file");
      }

      const { key, file_hash } = (await uploadResponse.json()) as UploadResponse;
      setUploadProgress(40);
      setUploadState("claiming");

      // Step 2: Claim the upload (include file_hash for caching)
      const claimResponse = await fetch("/api/resume/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, file_hash }),
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
            toast.success("Resume parsed successfully!");
            onContinue(siteData.content);
            return;
          }
        }
        throw new Error("Failed to load cached resume data");
      }

      // Poll for parsing completion
      const parsingResult = await pollResumeStatus(resumeId);

      if (parsingResult) {
        setUploadProgress(100);
        toast.success("Resume parsed successfully!");
        onContinue(parsingResult);
      }
    } catch (err) {
      let errorMessage = "Failed to process resume";

      if (err instanceof Error) {
        if (err.message.includes("429") || err.message.includes("limit")) {
          errorMessage = "Upload limit reached (5 per day). Try again tomorrow.";
        } else if (err.message.includes("413") || err.message.includes("large")) {
          errorMessage = "File too large. Maximum size is 5MB.";
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
    // Clear any polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
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
        <div className="mx-auto w-16 h-16 bg-linear-to-r from-indigo-100 to-blue-100 rounded-2xl flex items-center justify-center mb-6">
          <Upload className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 leading-tight">
          Upload Your Resume
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Drop your PDF to get started. We&apos;ll extract your experience in seconds.
        </p>
      </div>

      {/* Upload Zone */}
      <div className="max-w-md mx-auto space-y-4">
        {uploadState === "error" ? (
          /* Error State */
          <div className="bg-white rounded-2xl border border-red-200 p-8 text-center">
            <div className="relative mx-auto w-16 h-16 mb-4">
              <div className="absolute inset-0 bg-red-500 rounded-full blur-xl opacity-20" />
              <div className="relative w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-500"
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
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-2">Something Went Wrong</h3>
            <p className="text-sm text-red-600 mb-6">{error}</p>

            <Button
              onClick={handleRetry}
              className="w-full bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold shadow-depth-sm hover:shadow-depth-md transition-all duration-300"
              size="lg"
            >
              Try Again
            </Button>
          </div>
        ) : isProcessing ? (
          /* Processing State */
          <div className="bg-white rounded-2xl border border-slate-200/60 p-8 text-center">
            <div className="relative mx-auto w-16 h-16 mb-4">
              <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-blue-500 rounded-full blur-xl opacity-30 animate-pulse" />
              <div className="relative w-16 h-16 bg-linear-to-r from-indigo-100 to-blue-100 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {uploadState === "parsing" ? "AI Parsing Your Resume" : "Processing..."}
            </h3>
            <p className="text-sm text-slate-600 mb-4">{getProgressMessage()}</p>

            {uploadState === "parsing" && (
              <p className="text-xs text-slate-400 font-medium mb-4">
                This typically takes ~30 seconds
              </p>
            )}

            <Progress value={uploadProgress} className="h-2 bg-slate-100" />
            <p className="text-xs text-slate-500 mt-2 font-medium">{uploadProgress}%</p>
          </div>
        ) : (
          /* Idle State - Drop Zone */
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Drop your PDF resume here or click to browse files"
            className={`
              group relative bg-white rounded-2xl border border-slate-200/60 p-12 cursor-pointer transition-all duration-300 overflow-hidden
              ${
                isDragging
                  ? "border-indigo-500 bg-linear-to-br from-indigo-50 to-blue-50 shadow-depth-lg -translate-y-1"
                  : "hover:border-indigo-300 hover:shadow-depth-md"
              }
            `}
          >
            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 bg-linear-to-br from-indigo-50/50 via-transparent to-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
              tabIndex={-1}
            />

            <div className="relative z-10 flex flex-col items-center gap-4">
              {/* Icon with gradient background */}
              <div className="relative">
                <div
                  className={`absolute inset-0 bg-linear-to-r from-indigo-500 to-blue-500 rounded-2xl blur-xl transition-opacity duration-300 ${isDragging ? "opacity-40" : "opacity-20 group-hover:opacity-40"}`}
                />
                <div
                  className={`relative bg-linear-to-r from-indigo-100 to-blue-100 p-4 rounded-2xl transition-transform duration-300 ${isDragging ? "scale-110" : "group-hover:scale-110"}`}
                >
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <defs>
                      <linearGradient id="uploadGradientWizard" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#4F46E5" />
                        <stop offset="100%" stopColor="#3B82F6" />
                      </linearGradient>
                    </defs>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      stroke="url(#uploadGradientWizard)"
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
              </div>

              {/* Title text */}
              <p className="text-lg font-semibold text-slate-900">
                {file ? file.name : "Drop your PDF resume here"}
              </p>

              {/* Secondary text */}
              <p className="text-sm text-slate-500">or click to browse - Max 5MB</p>
            </div>
          </div>
        )}

        {/* Help Text */}
        {uploadState === "idle" && (
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-700 mb-2">Supported formats:</p>
            <ul className="text-xs text-slate-600 space-y-1">
              <li>* PDF files only</li>
              <li>* Maximum file size: 5MB</li>
              <li>* Best results with text-based PDFs (not scanned images)</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
