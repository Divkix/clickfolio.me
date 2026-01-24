"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { signIn, useSession } from "@/lib/auth/client";
import { validatePDF } from "@/lib/utils/validation";

/**
 * Set pending upload cookie via API (primary storage)
 * Falls back silently if API call fails - sessionStorage remains as backup
 */
async function setPendingUploadCookie(key: string): Promise<void> {
  try {
    await fetch("/api/upload/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
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

      const { key } = (await uploadResponse.json()) as UploadResponse;

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

      // Step 2b: Set HTTP-only cookie via API - PRIMARY storage
      await setPendingUploadCookie(key);

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
      const claimResponse = await fetch("/api/resume/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });

      if (!claimResponse.ok) {
        const data = (await claimResponse.json()) as ClaimResponse;
        throw new Error(data.error || "Failed to claim resume");
      }

      await claimResponse.json();

      // Clear temp data from sessionStorage
      sessionStorage.removeItem("temp_upload");

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

  // Dropzone content (before upload complete) - Neubrutalist style
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
          group
          relative
          bg-cream
          border-3
          border-dashed
          border-ink
          p-8
          cursor-pointer
          transition-all
          duration-200
          ${
            isDragging
              ? "bg-amber/20 border-solid border-coral translate-x-[-2px] translate-y-[-2px] shadow-brutal-md"
              : "hover:bg-amber/10 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-sm"
          }
          ${uploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
          tabIndex={-1}
        />

        <div className="flex flex-col items-center gap-4">
          {/* Icon */}
          <div
            className={`
              w-16
              h-16
              border-3
              border-ink
              flex
              items-center
              justify-center
              transition-all
              duration-200
              ${isDragging ? "bg-coral rotate-3" : "bg-amber group-hover:rotate-3"}
            `}
          >
            <svg className="w-8 h-8 text-ink" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                stroke="currentColor"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          {/* Text */}
          <div className="text-center">
            <p className="font-black text-lg text-ink mb-1">
              {file ? file.name : "Drop your PDF here"}
            </p>
            <p className="font-mono text-sm text-[#6B6B6B]">or click to browse • Max 5MB</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {uploading && (
        <div className="space-y-2">
          <div className="h-3 bg-cream border-2 border-ink overflow-hidden">
            <div
              className="h-full bg-mint transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="font-mono text-xs text-center text-[#6B6B6B]" aria-live="polite">
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
        <div className="bg-coral/10 border-3 border-coral p-4" role="alert">
          <p className="font-bold text-sm text-coral mb-3">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="
              w-full
              bg-ink
              text-cream
              font-black
              py-2
              px-4
              border-2
              border-ink
              hover:bg-coral
              hover:text-white
              transition-colors
            "
          >
            Try Again
          </button>
        </div>
      )}

      {/* Info Text - only show when not in modal mode */}
      {!uploading && !error && !isModal && (
        <p className="font-mono text-xs text-[#6B6B6B] text-center">
          Upload anonymously. No account needed until you&apos;re ready to publish.
        </p>
      )}
    </div>
  );

  // Upload complete state content - Neubrutalist style
  const uploadCompleteContent = (
    <div className="space-y-4">
      <div className="bg-white border-3 border-ink p-6">
        {claiming ? (
          /* Claiming State - For Authenticated Users */
          <div className="flex flex-col items-center gap-4">
            <div
              className="
                w-16
                h-16
                bg-mint
                border-3
                border-ink
                flex
                items-center
                justify-center
                animate-pulse
              "
            >
              <svg
                className="w-8 h-8 text-ink animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>

            <div className="text-center">
              <h3 className="font-black text-lg text-ink mb-2">AI Parsing Your Resume...</h3>
              <p className="font-medium text-sm text-[#6B6B6B] mb-1" aria-live="polite">
                Extracting your experience, skills, and achievements
              </p>
              <p className="font-mono text-xs text-[#6B6B6B]">This typically takes ~30 seconds</p>
            </div>
          </div>
        ) : error ? (
          /* Error State during claiming */
          <div className="flex flex-col items-center gap-4">
            <div
              className="
                w-16
                h-16
                bg-coral
                border-3
                border-ink
                flex
                items-center
                justify-center
              "
            >
              <svg
                className="w-8 h-8 text-white"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>

            <div className="text-center">
              <h3 className="font-black text-lg text-ink mb-2">Something Went Wrong</h3>
              <p className="font-bold text-sm text-coral mb-4">{error}</p>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="
                w-full
                max-w-xs
                bg-ink
                text-cream
                font-black
                py-3
                px-6
                border-3
                border-ink
                shadow-brutal-sm
                hover:-translate-x-0.5
                hover:-translate-y-0.5
                hover:shadow-brutal-md
                active:translate-x-0
                active:translate-y-0
                active:shadow-none
                transition-all
                duration-150
              "
            >
              Try Again
            </button>
          </div>
        ) : (
          /* Upload Complete - Show different CTA based on auth status */
          <div className="flex flex-col items-center gap-4">
            <div
              className="
                w-16
                h-16
                bg-mint
                border-3
                border-ink
                flex
                items-center
                justify-center
                rotate-3
              "
            >
              <svg className="w-8 h-8 text-ink" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  stroke="currentColor"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <div className="text-center">
              <h3 className="font-black text-lg text-ink mb-2">Upload Complete!</h3>
              <p className="font-medium text-sm text-[#6B6B6B] mb-4">
                {file?.name} has been uploaded successfully.
              </p>
            </div>

            {user ? (
              /* Authenticated user - shouldn't reach here as auto-claim happens */
              <p className="font-mono text-xs text-[#6B6B6B] text-center" aria-live="polite">
                Redirecting to dashboard...
              </p>
            ) : (
              /* Anonymous user - show login button */
              <>
                <button
                  type="button"
                  onClick={handleLoginRedirect}
                  disabled={claiming}
                  className="
                    w-full
                    max-w-xs
                    bg-coral
                    text-white
                    font-black
                    py-3
                    px-6
                    border-3
                    border-ink
                    shadow-brutal-sm
                    hover:-translate-x-0.5
                    hover:-translate-y-0.5
                    hover:shadow-brutal-md
                    active:translate-x-0
                    active:translate-y-0
                    active:shadow-none
                    transition-all
                    duration-150
                    disabled:opacity-50
                    disabled:cursor-not-allowed
                    disabled:hover:translate-x-0
                    disabled:hover:translate-y-0
                    disabled:hover:shadow-brutal-sm
                  "
                >
                  Sign in to Publish →
                </button>

                <p className="font-mono text-xs text-[#6B6B6B] text-center">
                  Your upload will be automatically claimed after login
                </p>

                <button
                  type="button"
                  onClick={handleReset}
                  className="font-mono text-xs text-[#6B6B6B] hover:text-ink underline transition-colors"
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
        <DialogContent className="sm:max-w-md border-3 border-ink shadow-brutal-lg rounded-none">
          <DialogHeader>
            <DialogTitle className="font-black text-ink">Upload New Resume</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return content;
}
