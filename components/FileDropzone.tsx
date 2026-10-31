import { ShieldCheck } from "lucide-react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { LinkedInExportHelp } from "@/components/LinkedInExportHelp";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFileUpload } from "@/hooks/useFileUpload";
import { SignInButton, useSession } from "@/lib/auth/client";
import { clearPendingUploadCookie } from "@/lib/utils/pending-upload-client";
import { MAX_FILE_SIZE_LABEL } from "@/lib/utils/validation";

interface FileDropzoneProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ClaimResponse {
  error?: string;
}

interface ClaimFailure {
  status?: number;
  message?: string;
}

function claimErrorMessage(err: ClaimFailure): string {
  // SAFETY: err is a thrown fetch/claim failure (Error-like or Response-like); ClaimFailure
  // models the optional status read for rate-limit handling.
  if (err instanceof Response || (err as { status?: number })?.status) {
    // SAFETY: err status check uses optional status property from thrown Response-like error; cast is safe for branching.
    const status = err instanceof Response ? err.status : (err as { status?: number }).status;

    if (status === 429) return "Upload limit reached (5 per day). Try again tomorrow.";

    if (status === 401) return "Session expired. Please sign in again.";

    if (status === 404) return "We couldn't find this upload. Please choose the PDF again.";

    if (status === 409) return "This résumé is already in your account.";
  } else if (err instanceof Error) {
    if (err.message.includes("network") || err.message.includes("Network")) {
      return "Network error. Check your connection.";
    }

    if (err.message) {
      return err.message;
    }
  }

  return "We couldn't save your résumé. Please try again.";
}

export function FileDropzone({ open, onOpenChange }: FileDropzoneProps) {
  const router = useRouter();
  const navigate = useNavigate();
  const { data: session, isPending: sessionLoading } = useSession();
  const user = session?.user ?? null;

  const upload = useFileUpload();

  const {
    file,
    uploadState,
    error,
    uploadedKey,
    setUploadedKey,
    setUploadProgress,
    setUploadState,
    setError,
    setFile,
    processFile,
  } = upload;

  const uploading = uploadState === "uploading" || uploadState === "claiming";

  // The claim cycle runs whenever an uploaded key is waiting on a signed-in
  // user; there is no intermediate "claiming" render state to store.
  const claiming = uploadedKey !== null && user !== null && error === null;
  const claimedKeyRef = useRef<string | null>(null);
  const anonymousUploadRef = useRef(false);

  const claimUpload = useCallback(
    async (key: string) => {
      try {
        // The wizard owns the cookie handoff after authentication, including Clerk's redirect.
        // Do not race its claim with another POST from the page the visitor is leaving.
        if (anonymousUploadRef.current) {
          await navigate({ to: "/wizard", replace: true });

          return;
        }

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
          throw Object.assign(new Error(data.error || "We couldn't save your résumé."), {
            status: claimResponse.status,
          });
        }

        await claimResponse.json();

        setUploadedKey(null);

        await clearPendingUploadCookie();

        toast.success("Résumé saved! Preparing your next step…");

        if (onOpenChange) {
          onOpenChange(false);
        }

        await navigate({ to: "/dashboard", replace: true });
        await router.invalidate();
      } catch (err) {
        // SAFETY: caught values are Error-like or Response-like as thrown by fetch/claim;
        // ClaimFailure models the optional status and message the helper reads.
        const errorMessage = claimErrorMessage(err as ClaimFailure);

        setUploadedKey(null);

        await clearPendingUploadCookie();
        setError(errorMessage);
        onOpenChange(true);
        toast.error(errorMessage);
      }
    },
    [navigate, router, onOpenChange, setError, setUploadedKey],
  );

  useEffect(() => {
    if (!uploadedKey) {
      claimedKeyRef.current = null;
      anonymousUploadRef.current = false;

      return;
    }

    if (sessionLoading) return;
    const currentUser = session?.user;

    if (!currentUser) {
      anonymousUploadRef.current = true;

      return;
    }

    if (claimedKeyRef.current === uploadedKey) return;

    claimedKeyRef.current = uploadedKey;

    void claimUpload(uploadedKey);
  }, [sessionLoading, uploadedKey, session?.user, claimUpload]);

  const handleReset = () => {
    setFile(null);
    setUploadedKey(null);
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

  const content =
    uploadedKey !== null ? (
      <UploadComplete
        claiming={claiming}
        error={error}
        fileName={file?.name}
        hasUser={user !== null}
        onReset={handleReset}
        onSignUp={() => {
          anonymousUploadRef.current = true;
          flushSync(() => onOpenChange(false));
        }}
      />
    ) : (
      <FileDropzonePrompt upload={upload} uploading={uploading} onRetry={handleRetry} />
    );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {open && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload your résumé</DialogTitle>
            </DialogHeader>
            {content}
          </DialogContent>
        )}
      </Dialog>
      {claiming && !open && (
        <output className="fixed inset-x-4 bottom-4 z-50 rounded-xl border border-border bg-card p-4 text-center shadow-lg">
          Saving your résumé. Opening the next step…
        </output>
      )}
    </>
  );
}

function UploadProgress({ uploadProgress }: { uploadProgress: number }) {
  return (
    <div className="space-y-2">
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-brand transition-[width] duration-300"
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
  );
}

function TrustSignals({ uploading, error }: { uploading: boolean; error: string | null }) {
  if (uploading || error) return null;

  return (
    <a
      href="https://github.com/divkix/clickfolio.me"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mt-3"
    >
      <ShieldCheck className="w-4 h-4" />
      <span>Open source &amp; transparent — audit the code yourself</span>
    </a>
  );
}

function FileDropzonePrompt({
  upload,
  uploading,
  onRetry,
}: {
  upload: ReturnType<typeof useFileUpload>;
  uploading: boolean;
  onRetry: () => void;
}) {
  const {
    file,
    isDragging,
    uploadProgress,
    error,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
  } = upload;

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
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

      {!uploading && !error && !file && <LinkedInExportHelp />}

      {uploading && <UploadProgress uploadProgress={uploadProgress} />}

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4" role="alert">
          <p className="font-medium text-sm text-destructive mb-3">{error}</p>
          <Button type="button" onClick={onRetry} className="w-full">
            Try Again
          </Button>
        </div>
      )}

      <TrustSignals uploading={uploading} error={error} />
    </div>
  );
}

function UploadComplete({
  claiming,
  error,
  fileName,
  hasUser,
  onReset,
  onSignUp,
}: {
  claiming: boolean;
  error: string | null;
  fileName: string | undefined;
  hasUser: boolean;
  onReset: () => void;
  onSignUp: () => void;
}) {
  return (
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
              <h3 className="font-semibold text-lg text-foreground mb-2">Saving your résumé…</h3>
              <p className="text-sm text-muted-foreground mb-1" aria-live="polite">
                Preparing your résumé for the next step
              </p>
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

            <Button type="button" onClick={onReset} className="w-full max-w-xs">
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
                {fileName} has been uploaded successfully.
              </p>
            </div>

            {hasUser ? (
              <p className="text-xs text-muted-foreground text-center" aria-live="polite">
                Redirecting to dashboard...
              </p>
            ) : (
              <>
                <SignInButton mode="sign-up" fallbackRedirectUrl="/wizard" onBeforeOpen={onSignUp}>
                  <Button type="button" disabled={claiming} className="w-full max-w-xs">
                    Sign up to publish
                  </Button>
                </SignInButton>

                <p className="text-xs text-muted-foreground text-center">
                  Create a free account to publish. We'll keep this résumé and add it to your
                  account.
                </p>

                <button
                  type="button"
                  onClick={onReset}
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
}
