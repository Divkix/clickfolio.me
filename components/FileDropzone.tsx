"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { signIn, useSession } from "@/lib/auth/client";
import { validatePDF } from "@/lib/utils/validation";

/**
 * Set pending upload cookie via API (primary storage)
 * Falls back silently if API call fails - sessionStorage remains as backup
 */
async function setPendingUploadCookie(key: string, fileHash: string | null): Promise<void> {
  try {
    await fetch("/api/upload/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, file_hash: fileHash }),
    });
  } catch (error) {
    console.warn("Failed to set pending upload cookie, using sessionStorage fallback:", error);
  }
}

/**
 * Clear pending upload cookie via API
 * Best effort - silent failure is acceptable
 */
async function clearPendingUploadCookie(): Promise<void> {
  try {
    await fetch("/api/upload/pending", { method: "DELETE" });
  } catch (error) {
    console.warn("Failed to clear pending upload cookie:", error);
  }
}

interface FileDropzoneProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface UploadResponse {
  key: string;
  file_hash: string;
  remaining: { hourly: number; daily: number };
  error?: string;
  message?: string;
}

interface ClaimResponse {
  error?: string;
}

export function FileDropzone({ open, onOpenChange }: FileDropzoneProps = {}) {
  const isModal = open !== undefined && onOpenChange !== undefined;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user ?? null;

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [claiming, setClaiming] = useState(false);
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
    uploadFile(selectedFile);
  };

  const uploadFile = async (fileToUpload: File) => {
    setUploading(true);
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

      setUploadProgress(70);

      if (!uploadResponse.ok) {
        const data = (await uploadResponse.json()) as UploadResponse;
        // Handle rate limiting specifically
        if (uploadResponse.status === 429) {
          throw new Error(data.message || "Too many upload attempts. Please wait and try again.");
        }
        throw new Error(data.error || "Failed to upload file");
      }

      const { key, file_hash } = (await uploadResponse.json()) as UploadResponse;

      setUploadProgress(90);

      // Step 2a: Save key to sessionStorage with expiry (30 min window) - FALLBACK
      sessionStorage.setItem(
        "temp_upload",
        JSON.stringify({
          key,
          timestamp: Date.now(),
          expiresAt: Date.now() + 30 * 60 * 1000,
        }),
      );

      // Store file hash in sessionStorage for claim
      if (file_hash) {
        sessionStorage.setItem("temp_file_hash", file_hash);
      }

      // Step 2b: Set HTTP-only cookie via API - PRIMARY storage
      await setPendingUploadCookie(key, file_hash || null);

      setUploadProgress(100);
      setUploadComplete(true);
      toast.success("File uploaded successfully!");

      // Step 3: If user is authenticated, auto-claim the upload
      if (user) {
        await claimUpload(key);
      }
    } catch (err) {
      let errorMessage = "Failed to upload file";

      // Differentiate error types by status code
      if (err instanceof Response || (err as { status?: number })?.status) {
        const status = err instanceof Response ? err.status : (err as { status?: number }).status;
        if (status === 429) {
          errorMessage = "Upload limit reached (5 per day). Try again tomorrow.";
        } else if (status === 413) {
          errorMessage = "File too large. Maximum size is 5MB.";
        } else if (status === 401) {
          errorMessage = "Session expired. Please sign in again.";
        } else if (status === 409) {
          errorMessage = "This file was already uploaded.";
        }
      } else if (err instanceof Error) {
        if (err.message.includes("network") || err.message.includes("Network")) {
          errorMessage = "Network error. Check your connection.";
        } else if (err.message) {
          errorMessage = err.message;
        }
      }

      // Clean up temp storage on error (both sessionStorage and cookie)
      sessionStorage.removeItem("temp_upload");
      sessionStorage.removeItem("temp_file_hash");
      await clearPendingUploadCookie();

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const claimUpload = async (key: string) => {
    setClaiming(true);
    setError(null);

    try {
      // Include file hash for deduplication caching (from sessionStorage as fallback)
      const fileHash = sessionStorage.getItem("temp_file_hash");

      const claimResponse = await fetch("/api/resume/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, file_hash: fileHash }),
      });

      if (!claimResponse.ok) {
        const data = (await claimResponse.json()) as ClaimResponse;
        throw new Error(data.error || "Failed to claim resume");
      }

      await claimResponse.json();

      // Clear temp data from sessionStorage
      sessionStorage.removeItem("temp_upload");
      sessionStorage.removeItem("temp_file_hash");

      // Clear HTTP-only cookie
      await clearPendingUploadCookie();

      toast.success("Resume claimed successfully! Processing...");

      // Close modal if in modal mode
      if (onOpenChange) {
        onOpenChange(false);
      }

      // Redirect to dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      let errorMessage = "Failed to claim resume";

      // Differentiate error types by status code
      if (err instanceof Response || (err as { status?: number })?.status) {
        const status = err instanceof Response ? err.status : (err as { status?: number }).status;
        if (status === 429) {
          errorMessage = "Upload limit reached (5 per day). Try again tomorrow.";
        } else if (status === 401) {
          errorMessage = "Session expired. Please sign in again.";
        } else if (status === 404) {
          errorMessage = "Upload not found. Please try uploading again.";
        } else if (status === 409) {
          errorMessage = "This resume was already claimed.";
        }
      } else if (err instanceof Error) {
        if (err.message.includes("network") || err.message.includes("Network")) {
          errorMessage = "Network error. Check your connection.";
        } else if (err.message) {
          errorMessage = err.message;
        }
      }

      // Clean up temp storage on error (both sessionStorage and cookie)
      sessionStorage.removeItem("temp_upload");
      sessionStorage.removeItem("temp_file_hash");
      await clearPendingUploadCookie();

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setClaiming(false);
    }
  };

  const handleLoginRedirect = async () => {
    try {
      await signIn.social({
        provider: "google",
        callbackURL: "/wizard",
      });
    } catch (err) {
      console.error("Error signing in:", err);
      toast.error("Failed to sign in. Please try again.");
    }
  };

  const handleReset = () => {
    setFile(null);
    setUploadComplete(false);
    setClaiming(false);
    setError(null);
    setUploadProgress(0);
  };

  const handleRetry = () => {
    setError(null);
    setUploadProgress(0);
    if (file) {
      uploadFile(file);
    }
  };

  // Dropzone content (before upload complete)
  const dropzoneContent = (
    <div className="space-y-4">
      {/* Drop Zone */}
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
            group relative bg-white rounded-2xl border border-slate-200/60 p-12 cursor-pointer transition-all duration-300 backdrop-blur-sm overflow-hidden
            ${isModal ? "" : "shadow-depth-md"}
            ${
              isDragging
                ? "border-indigo-500 bg-linear-to-br from-indigo-50 to-blue-50 shadow-depth-lg -translate-y-1"
                : isModal
                  ? "hover:border-indigo-300"
                  : "hover:shadow-depth-lg hover:-translate-y-1"
            }
            ${uploading ? "pointer-events-none opacity-60" : ""}
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
          disabled={uploading}
          tabIndex={-1}
        />

        <div className="relative z-10 flex flex-col items-center gap-4">
          {/* Title text first */}
          <p className="text-lg font-semibold text-slate-900">
            {file ? file.name : "Drop your PDF resume here"}
          </p>

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
                  <linearGradient id="uploadGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4F46E5" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  stroke="url(#uploadGradient)"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
          </div>

          {/* Secondary text below */}
          <p className="text-sm text-slate-500">or click to browse - Max 5MB</p>
        </div>
      </div>

      {/* Progress Bar */}
      {uploading && (
        <div className="space-y-2">
          <Progress
            value={uploadProgress}
            className="h-2"
            aria-label={`Upload progress: ${uploadProgress}%`}
          />
          <p className="text-xs text-center text-slate-500 font-medium" aria-live="polite">
            {uploadProgress < 40
              ? "Preparing upload..."
              : uploadProgress < 90
                ? "Uploading file..."
                : uploadProgress < 100
                  ? "Finalizing..."
                  : "Complete!"}{" "}
            {uploadProgress}%
          </p>
        </div>
      )}

      {/* Error Message with Retry Button */}
      {error && (
        <div
          className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-depth-sm"
          role="alert"
        >
          <p className="text-sm text-red-800 font-medium mb-3">{error}</p>
          <Button
            onClick={handleRetry}
            variant="outline"
            size="sm"
            className="w-full bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white border-0 font-semibold transition-all duration-300"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Info Text - only show when not in modal mode */}
      {!uploading && !error && !isModal && (
        <p className="text-sm text-slate-500 text-center">
          Upload anonymously. No account needed until you&apos;re ready to publish.
        </p>
      )}
    </div>
  );

  // Upload complete state content
  const uploadCompleteContent = (
    <div className="space-y-4">
      <div
        className={`bg-white rounded-2xl border border-slate-200/60 p-8 ${isModal ? "" : "shadow-depth-md"}`}
      >
        {claiming ? (
          /* Claiming State - For Authenticated Users */
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-blue-500 rounded-full blur-xl opacity-30 animate-pulse" />
              <div className="relative w-16 h-16 bg-linear-to-r from-indigo-100 to-blue-100 rounded-full flex items-center justify-center shadow-depth-md">
                <svg
                  className="w-8 h-8 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="url(#spinnerGradient)"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="url(#spinnerGradient)"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                  <defs>
                    <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4F46E5" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900 mb-2">AI Parsing Your Resume...</h3>
              <p className="text-sm text-slate-600 mb-1" aria-live="polite">
                Extracting your experience, skills, and achievements
              </p>
              <p className="text-xs text-slate-400 font-medium">This typically takes ~30 seconds</p>
            </div>

            {/* Subtle animated progress indicator */}
            <div className="w-full max-w-xs">
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-linear-to-r from-indigo-500 to-blue-500 rounded-full animate-pulse w-2/3" />
              </div>
            </div>
          </div>
        ) : error ? (
          /* Error State during claiming */
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500 rounded-full blur-xl opacity-20" />
              <div className="relative w-16 h-16 bg-red-100 rounded-full flex items-center justify-center shadow-depth-md">
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

            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Something Went Wrong</h3>
              <p className="text-sm text-red-600 mb-4">{error}</p>
            </div>

            <Button
              onClick={handleReset}
              className="w-full max-w-xs bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold shadow-depth-md hover:shadow-depth-lg transition-all duration-300"
            >
              Try Again
            </Button>
          </div>
        ) : (
          /* Upload Complete - Show different CTA based on auth status */
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-linear-to-r from-emerald-500 to-teal-500 rounded-full blur-xl opacity-30" />
              <div className="relative w-16 h-16 bg-linear-to-r from-emerald-100 to-teal-100 rounded-full flex items-center justify-center shadow-depth-md">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    stroke="url(#successGradient)"
                    d="M5 13l4 4L19 7"
                  />
                  <defs>
                    <linearGradient id="successGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#14B8A6" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Upload Complete!</h3>
              <p className="text-sm text-slate-600 mb-4">
                {file?.name} has been uploaded successfully.
              </p>
            </div>

            {user ? (
              /* Authenticated user - shouldn't reach here as auto-claim happens */
              <p className="text-xs text-slate-500 text-center font-medium" aria-live="polite">
                Redirecting to dashboard...
              </p>
            ) : (
              /* Anonymous user - show login button */
              <>
                <Button
                  onClick={handleLoginRedirect}
                  disabled={claiming}
                  className="w-full max-w-xs bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold shadow-depth-md hover:shadow-depth-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sign in to Publish
                </Button>

                <p className="text-xs text-slate-500 text-center font-medium">
                  Your upload will be automatically claimed after login
                </p>

                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors duration-300"
                >
                  Upload a different file
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Select content based on upload state
  const content = uploadComplete ? uploadCompleteContent : dropzoneContent;

  // When in modal mode, wrap in Dialog
  if (isModal) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload New Resume</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return content;
}
