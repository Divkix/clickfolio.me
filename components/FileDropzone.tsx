"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFileUpload } from "@/hooks/useFileUpload";
import { SignInButton, useSession } from "@/lib/auth/client";
import { clearPendingUploadCookie } from "@/lib/utils/pending-upload-client";
import { MAX_FILE_SIZE_LABEL } from "@/lib/utils/validation";
interface FileDropzoneProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ClaimResponse {
  error?: string;
}

export function FileDropzone({ open, onOpenChange }: FileDropzoneProps = {}) {
  const isModal = open !== undefined && onOpenChange !== undefined;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const user = session?.user ?? null;

  const [claiming, setClaiming] = useState(false);

  const {
    file,
    uploadProgress,
    uploadState,
    error,
    isDragging,
    uploadedKey,
    setUploadedKey,
    setUploadProgress,
    setUploadState,
    setError,
    setFile,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    processFile,
  } = useFileUpload();

  const uploading = uploadState === "uploading" || uploadState === "claiming";

  const claimUpload = useCallback(
    async (key: string) => {
      setClaiming(true);
      setError(null);

      try {
        const claimResponse = await fetch("/api/resume/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            key,
          }),
        });

        if (!claimResponse.ok) {
          // SAFETY: ClaimResponse is from our /api/resume/claim endpoint; shape validated server-side.
          const data = (await claimResponse.json()) as ClaimResponse;
          throw new Error(data.error || "Failed to claim resume");
        }

        await claimResponse.json();

        setUploadedKey(null);

        await clearPendingUploadCookie();

        toast.success("Resume claimed successfully! Processing...");

        if (onOpenChange) {
          onOpenChange(false);
        }

        await new Promise((resolve) => setTimeout(resolve, 100));

        router.replace("/dashboard");
        router.refresh();
      } catch (err) {
        let errorMessage = "Failed to claim resume";

        // SAFETY: err is Error-like with optional status from fetch throw; cast narrows to status check for rate-limit handling.
        if (err instanceof Response || (err as { status?: number })?.status) {
          // SAFETY: err status check uses optional status property from thrown Response-like error; cast is safe for branching.
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

        setUploadedKey(null);

        await clearPendingUploadCookie();
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setClaiming(false);
      }
    },
    [router, onOpenChange, setError, setUploadedKey],
  );

  useEffect(() => {
    if (sessionLoading) return;
    if (!uploadedKey) return;
    const currentUser = session?.user;
    if (!currentUser) return;
    if (claiming) return;

    void claimUpload(uploadedKey);
  }, [sessionLoading, uploadedKey, session?.user, claiming, claimUpload]);

  const handleReset = () => {
    setFile(null);
    setUploadedKey(null);
    setClaiming(false);
    setError(null);
    setUploadProgress(0);
    setUploadState("idle");
  };
  const handleRetry = () => {
    setError(null);
    setUploadProgress(0);
    setUploadState("idle");
    if (file) {
      processFile(file);
    }
  };

  const dropzoneContent = (
    <div className="space-y-4">
      <button
        type="button"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        aria-label="Drop your PDF resume here or click to browse files"
        className={`
          w-full
          group
          relative
          rounded-xl
          bg-card
          border
          border-dashed
          border-border-strong
          p-8
          cursor-pointer
          transition-colors
          ${
            isDragging
              ? "bg-brand-subtle border-brand"
              : "hover:bg-surface-2 hover:border-border-strong"
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
          aria-label="Upload PDF file"
        />

        <div className="flex flex-col items-center gap-4">
          <div
            className={`
              w-16
              h-16
              rounded-xl
              flex
              items-center
              justify-center
              transition-colors
              ${isDragging ? "bg-brand text-brand-foreground" : "bg-brand-subtle text-brand"}
            `}
          >
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                stroke="currentColor"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <div className="text-center">
            <p className="font-semibold text-lg text-foreground mb-1">
              {file ? file.name : "Drop your PDF here"}
            </p>
            <p className="text-sm text-foreground/80">
              or click to browse • Max {MAX_FILE_SIZE_LABEL}
            </p>
            {!uploading && !error && !file && (
              <div className="bg-brand text-brand-foreground font-medium text-sm py-2 px-5 rounded-md inline-block mt-3 shadow-xs">
                Choose PDF
              </div>
            )}
          </div>
        </div>
      </button>

      {uploading && (
        <div className="space-y-2">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-brand transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs text-center text-muted-foreground" aria-live="polite">
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

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4" role="alert">
          <p className="font-medium text-sm text-destructive mb-3">{error}</p>
          <Button type="button" onClick={handleRetry} className="w-full">
            Try Again
          </Button>
        </div>
      )}

      {!uploading && !error && (
        <a
          href="https://github.com/divkix/clickfolio.me"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mt-3"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Open source &amp; transparent — audit the code yourself</span>
        </a>
      )}

      {!uploading && !error && !isModal && (
        <div className="flex items-center justify-center gap-2 bg-success/10 border border-success/30 rounded-lg px-3 py-2 mt-3">
          <svg
            className="w-4 h-4 text-success shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-xs text-muted-foreground">
            Upload anonymously. No account needed until you publish.
          </span>
        </div>
      )}
    </div>
  );

  const uploadCompleteContent = (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-6">
        {claiming ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-brand-subtle text-brand flex items-center justify-center">
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
              <h3 className="font-semibold text-lg text-foreground mb-2">
                AI Parsing Your Resume...
              </h3>
              <p className="text-sm text-muted-foreground mb-1" aria-live="polite">
                Extracting your experience, skills, and achievements
              </p>
              <p className="text-xs text-muted-foreground">This typically takes ~30 seconds</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  stroke="currentColor"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>

            <div className="text-center">
              <h3 className="font-semibold text-lg text-foreground mb-2">Something Went Wrong</h3>
              <p className="font-medium text-sm text-destructive mb-4">{error}</p>
            </div>

            <Button type="button" onClick={handleReset} className="w-full max-w-xs">
              Try Again
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-success/10 text-success flex items-center justify-center">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <div className="text-center">
              <h3 className="font-semibold text-lg text-foreground mb-2">Upload Complete!</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {file?.name} has been uploaded successfully.
              </p>
            </div>

            {user ? (
              <p className="text-xs text-muted-foreground text-center" aria-live="polite">
                Redirecting to dashboard...
              </p>
            ) : (
              <>
                <SignInButton mode="modal" fallbackRedirectUrl="/wizard">
                  <Button type="button" disabled={claiming} className="w-full max-w-xs">
                    Sign in to Publish
                  </Button>
                </SignInButton>

                <p className="text-xs text-muted-foreground text-center">
                  Your upload will be automatically claimed after login
                </p>

                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
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

  const content = uploadedKey !== null ? uploadCompleteContent : dropzoneContent;

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
