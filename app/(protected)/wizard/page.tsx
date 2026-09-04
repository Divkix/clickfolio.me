"use client";

export const revalidate = 86400;

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WizardProgress } from "@/components/wizard";
import { HandleStep } from "@/components/wizard/HandleStep";
import { PrivacyStep } from "@/components/wizard/PrivacyStep";
import { ReviewStep } from "@/components/wizard/ReviewStep";
import { ThemeStep } from "@/components/wizard/ThemeStep";
import { UploadStep } from "@/components/wizard/UploadStep";
import { YouAreLiveModal } from "@/components/YouAreLiveModal";
import { useSession } from "@/lib/auth/client";
import { DEFAULT_THEME, type ThemeId } from "@/lib/templates/theme-ids";
import type { ClaimResponse } from "@/lib/types/api";
import type { ResumeContent } from "@/lib/types/database";
import { clearPendingUploadCookie } from "@/lib/utils/pending-upload-client";
import { waitForResumeCompletion } from "@/lib/utils/wait-for-completion";

interface SiteDataResponse {
  id?: string;
  content?: ResumeContent;
  themeId?: string;
}

interface LatestResumeResponse {
  id?: string;
  status?: string;
  error?: string;
}

interface WizardCompleteResponse {
  success?: boolean;
  error?: string;
}

interface PendingUploadResponse {
  key: string | null;
  file_hash: string | null;
}

type WizardStepId = "upload" | "handle" | "review" | "privacy" | "theme";

function getStepOrder(needsUpload: boolean): WizardStepId[] {
  if (needsUpload) {
    return ["upload", "handle", "review", "privacy", "theme"];
  }
  return ["handle", "review", "privacy", "theme"];
}

interface WizardState {
  currentStepId: WizardStepId;
  resumeData: ResumeContent | null;
  handle: string;
  privacySettings: {
    show_phone: boolean;
    show_address: boolean;
    show_in_directory: boolean;
    hide_from_search: boolean;
  };
  themeId: ThemeId;
}

export default function WizardPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const userId = session?.user?.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsUpload, setNeedsUpload] = useState(false);
  const [showLiveModal, setShowLiveModal] = useState(false);

  const initializingRef = useRef(false);
  const hasClaimedRef = useRef(false);
  const navigateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<WizardState>({
    currentStepId: "handle",
    resumeData: null,
    handle: "",
    privacySettings: {
      show_phone: false,
      show_address: false,
      show_in_directory: true,
      hide_from_search: false,
    },
    themeId: DEFAULT_THEME,
  });

  const stepOrder = getStepOrder(needsUpload);
  const totalSteps = stepOrder.length;
  const currentStepNumber = stepOrder.indexOf(state.currentStepId) + 1;
  const progress = (currentStepNumber / totalSteps) * 100;

  // SAFETY: session.user from Better Auth lacks onboardingCompleted typed field; cast adds optional property from session payload validated via DB, safe fallback to false.
  const onboardingCompleted =
    (session?.user as { onboardingCompleted?: boolean } | undefined)?.onboardingCompleted === true;

  const awaitResumeComplete = useCallback(
    async (resumeId: string): Promise<boolean> => {
      const result = await waitForResumeCompletion(resumeId);

      if (result.status === "completed") {
        return true;
      }

      setError(result.error || "Resume parsing failed. Please try again.");
      navigateTimeoutRef.current = setTimeout(() => router.push("/dashboard"), 3000);
      return false;
    },
    [router],
  );

  useEffect(() => {
    const initializeWizard = async () => {
      if (initializingRef.current) return;

      if (sessionLoading) return;

      if (!userId) {
        router.push("/");
        return;
      }

      initializingRef.current = true;

      try {
        setLoading(true);

        if (onboardingCompleted) {
          router.push("/dashboard");
          return;
        }

        let tempKey: string | null = null;
        let fileHash: string | null = null;

        try {
          const pendingResponse = await fetch("/api/upload/pending");
          if (pendingResponse.ok) {
            // SAFETY: PendingUploadResponse is from our /api/upload/pending endpoint backed by HMAC-signed pending_upload cookie verified by server.
            const pending = (await pendingResponse.json()) as PendingUploadResponse;
            if (pending.key) {
              tempKey = pending.key;
              fileHash = pending.file_hash;
            }
          }
        } catch (cookieError) {
          console.warn("Failed to read pending upload cookie:", cookieError);
        }

        if (tempKey && !hasClaimedRef.current) {
          hasClaimedRef.current = true;

          setLoading(true);
          try {
            const claimResponse = await fetch("/api/resume/claim", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: tempKey, file_hash: fileHash }),
            });

            // SAFETY: ClaimResponse is from our /api/resume/claim endpoint; shape is server-controlled and validated before use.
            const claimData = (await claimResponse.json()) as ClaimResponse;

            if (!claimResponse.ok) {
              throw new Error(claimData.error || "Failed to claim resume");
            }

            if (!claimData.resume_id) {
              throw new Error("Server error: No resume ID returned");
            }

            const resumeId = claimData.resume_id;

            await clearPendingUploadCookie();

            if (!claimData.cached) {
              const parsingComplete = await awaitResumeComplete(resumeId);

              if (!parsingComplete) {
                return;
              }
            }
          } catch (claimError) {
            console.error("Claim error:", claimError);
            setError(claimError instanceof Error ? claimError.message : "Failed to claim resume");

            await clearPendingUploadCookie();

            hasClaimedRef.current = false;

            navigateTimeoutRef.current = setTimeout(() => router.push("/dashboard"), 3000);
            return;
          }
        }

        const siteDataResponse = await fetch("/api/site-data");
        if (siteDataResponse.ok) {
          // SAFETY: SiteDataResponse is from our /api/site-data endpoint; content is schema-validated JSON written only by queue consumer.
          const siteData = (await siteDataResponse.json()) as SiteDataResponse | null;

          if (siteData?.content) {
            // SAFETY: content is schema-validated JSON written only by our queue consumer.
            const content = siteData.content as ResumeContent;

            setState((prev) => ({
              ...prev,
              resumeData: content,
            }));

            setLoading(false);
            return;
          }
        }

        const statusResponse = await fetch("/api/resume/latest-status");
        if (statusResponse.ok) {
          // SAFETY: LatestResumeResponse is from our /api/resume/latest-status endpoint; shape validated server-side.
          const resume = (await statusResponse.json()) as LatestResumeResponse | null;

          if (resume?.status === "processing" && resume.id) {
            router.push(`/waiting?resume_id=${resume.id}`);
            return;
          }
        }

        setNeedsUpload(true);
        setState((prev) => ({ ...prev, currentStepId: "upload" }));
        setLoading(false);
      } catch (err) {
        console.error("Error initializing wizard:", err);
        setError("Failed to load resume data. Please try again.");
        setLoading(false);
      } finally {
        initializingRef.current = false;
      }
    };

    void initializeWizard();

    return () => {
      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current);
        navigateTimeoutRef.current = null;
      }
    };
  }, [router, userId, sessionLoading, awaitResumeComplete, onboardingCompleted]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentIndex = stepOrder.indexOf(state.currentStepId);
      if (currentIndex > 0 && !showLiveModal) {
        e.preventDefault();
        // returnValue is deprecated but required for cross-browser compatibility
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [state.currentStepId, stepOrder, showLiveModal]);

  const handleUploadComplete = (resumeData: ResumeContent) => {
    setState((prev) => ({
      ...prev,
      resumeData,
      currentStepId: "handle",
    }));
  };

  const handleHandleContinue = (handle: string) => {
    setState((prev) => ({
      ...prev,
      handle,
      currentStepId: "review",
    }));
  };

  const handleReviewContinue = () => {
    setState((prev) => ({ ...prev, currentStepId: "privacy" }));
  };

  const handlePrivacyContinue = (settings: {
    show_phone: boolean;
    show_address: boolean;
    show_in_directory: boolean;
    hide_from_search: boolean;
  }) => {
    setState((prev) => ({
      ...prev,
      privacySettings: settings,
      currentStepId: "theme",
    }));
  };

  const handleThemeContinue = async (themeId: ThemeId) => {
    try {
      setState((prev) => ({
        ...prev,
        themeId,
      }));

      const response = await fetch("/api/wizard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: state.handle,
          privacy_settings: state.privacySettings,
          theme_id: themeId,
        }),
      });

      // SAFETY: WizardCompleteResponse is from our /api/wizard/complete endpoint; error field checked before throwing.
      const data = (await response.json()) as WizardCompleteResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to complete setup");
      }

      setShowLiveModal(true);
    } catch (err) {
      console.error("Error completing wizard:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to complete setup";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleLiveModalClose = (open: boolean) => {
    setShowLiveModal(open);
    if (!open) {
      router.push("/dashboard");
    }
  };

  if (loading || sessionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading your resume...</p>
          <p className="text-muted-foreground text-sm mt-2">
            This may take 30-60 seconds if we&apos;re parsing your PDF
          </p>
        </div>
      </div>
    );
  }

  if (error && state.currentStepId === "handle" && !needsUpload) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-card rounded-xl shadow-md border border-border p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              aria-hidden="true"
              className="w-8 h-8 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Something Went Wrong</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <YouAreLiveModal
        open={showLiveModal}
        onOpenChange={handleLiveModalClose}
        handle={state.handle}
      />

      <WizardProgress
        currentStep={currentStepNumber}
        totalSteps={totalSteps}
        progress={progress}
        hasUploadStep={needsUpload}
      />

      <main className="max-w-5xl mx-auto px-4 py-12">
        {error && stepOrder.indexOf(state.currentStepId) > 0 && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {state.currentStepId === "upload" && <UploadStep onContinue={handleUploadComplete} />}

        {state.currentStepId === "handle" && (
          <HandleStep initialHandle={state.handle} onContinue={handleHandleContinue} />
        )}

        {state.currentStepId === "review" && state.resumeData && (
          <ReviewStep content={state.resumeData} onContinue={handleReviewContinue} />
        )}

        {state.currentStepId === "privacy" && state.resumeData && (
          <PrivacyStep
            content={state.resumeData}
            initialSettings={state.privacySettings}
            onContinue={handlePrivacyContinue}
          />
        )}

        {state.currentStepId === "theme" && (
          <ThemeStep initialTheme={state.themeId} onContinue={handleThemeContinue} />
        )}
      </main>
    </div>
  );
}
