"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Confetti } from "@/components/Confetti";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WizardProgress } from "@/components/wizard";
import { HandleStep } from "@/components/wizard/HandleStep";
import { PrivacyStep } from "@/components/wizard/PrivacyStep";
import { ReviewStep } from "@/components/wizard/ReviewStep";
import { ThemeStep } from "@/components/wizard/ThemeStep";
import { UploadStep } from "@/components/wizard/UploadStep";
import { YouAreLiveModal } from "@/components/YouAreLiveModal";
import { useSession } from "@/lib/auth/client";
import type { ThemeId } from "@/lib/templates/theme-ids";
import type { ResumeContent } from "@/lib/types/database";
import { waitForResumeCompletion } from "@/lib/utils/wait-for-completion";

// Type definitions for API responses
interface ClaimResponse {
  resume_id: string;
  cached?: boolean;
  error?: string;
}

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

interface WizardState {
  currentStep: number;
  resumeData: ResumeContent | null;
  handle: string;
  privacySettings: {
    show_phone: boolean;
    show_address: boolean;
  };
  themeId: ThemeId;
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

/**
 * Wizard Page - Multi-step onboarding flow
 * Guides users through completing their profile setup
 *
 * Steps (standard 4-step flow):
 * 1. Handle Selection - Choose unique username
 * 2. Content Review - Verify parsed resume data
 * 3. Privacy Settings - Configure visibility of sensitive info
 * 4. Theme Selection - Choose resume template design
 *
 * Steps (5-step flow when needsUpload is true):
 * 1. Upload Resume - Drop PDF to upload
 * 2. Handle Selection - Choose unique username
 * 3. Content Review - Verify parsed resume data
 * 4. Privacy Settings - Configure visibility of sensitive info
 * 5. Theme Selection - Choose resume template design
 */
export default function WizardPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const userId = session?.user?.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsUpload, setNeedsUpload] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showLiveModal, setShowLiveModal] = useState(false);

  // Refs to prevent race conditions during wizard initialization
  const initializingRef = useRef(false);
  const hasClaimedRef = useRef(false);

  const [state, setState] = useState<WizardState>({
    currentStep: 1,
    resumeData: null,
    handle: "",
    privacySettings: {
      show_phone: false,
      show_address: false,
    },
    themeId: "minimalist_editorial",
  });

  // Compute total steps based on whether upload is needed
  const totalSteps = needsUpload ? 5 : 4;

  // Derive onboardingCompleted from session (used by initializeWizard for returning user check)
  const onboardingCompleted =
    (session?.user as { onboardingCompleted?: boolean } | undefined)?.onboardingCompleted === true;

  // Wait for resume completion via WebSocket (with polling fallback)
  const awaitResumeComplete = useCallback(
    async (resumeId: string): Promise<boolean> => {
      const result = await waitForResumeCompletion(resumeId);

      if (result.status === "completed") {
        return true;
      }

      // Failed
      setError(result.error || "Resume parsing failed. Please try again.");
      setTimeout(() => router.push("/dashboard"), 3000);
      return false;
    },
    [router],
  );

  // Fetch resume data on mount + handle upload claiming
  useEffect(() => {
    const initializeWizard = async () => {
      // Prevent concurrent initialization (race condition fix)
      if (initializingRef.current) return;

      // Wait for session to load
      if (sessionLoading) return;

      // Check authentication
      if (!userId) {
        router.push("/");
        return;
      }

      // Mark as initializing to prevent re-entry
      initializingRef.current = true;

      try {
        setLoading(true);

        // PRIMARY: Try reading pending upload from HTTP-only cookie via API
        // This is more reliable than sessionStorage (works across tabs, survives browser restart)
        let tempKey: string | null = null;
        let fileHash: string | null = null;

        try {
          const pendingResponse = await fetch("/api/upload/pending");
          if (pendingResponse.ok) {
            const pending = (await pendingResponse.json()) as PendingUploadResponse;
            if (pending.key) {
              tempKey = pending.key;
              fileHash = pending.file_hash;
            }
          }
        } catch (cookieError) {
          console.warn("Failed to read pending upload cookie:", cookieError);
        }

        // FALLBACK: Try sessionStorage (migration period - remove after 30 days)
        // This handles users who uploaded before the cookie implementation
        if (!tempKey) {
          const tempUploadStr = sessionStorage.getItem("temp_upload");
          if (tempUploadStr) {
            try {
              const tempUpload = JSON.parse(tempUploadStr) as {
                key: string;
                timestamp: number;
                expiresAt: number;
              };
              // Only use if not expired (30 min window)
              if (tempUpload.expiresAt > Date.now()) {
                tempKey = tempUpload.key;
                fileHash = sessionStorage.getItem("temp_file_hash");
                console.log("[Migration] Using sessionStorage fallback for pending upload");
              } else {
                // Expired - clean up stale data
                sessionStorage.removeItem("temp_upload");
                sessionStorage.removeItem("temp_file_hash");
                console.log("Cleared expired temp upload data");
              }
            } catch {
              // Invalid JSON - clean up
              sessionStorage.removeItem("temp_upload");
            }
          }
        }

        // RETURNING USER CHECK: If onboarding already completed, skip wizard entirely
        if (onboardingCompleted) {
          // Returning user — claim pending upload if exists, then redirect to dashboard
          if (tempKey) {
            try {
              const claimResponse = await fetch("/api/resume/claim", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: tempKey, file_hash: fileHash }),
              });

              const claimData = (await claimResponse.json()) as ClaimResponse;

              if (!claimResponse.ok) {
                throw new Error(claimData.error || "Failed to claim resume");
              }

              if (claimData.cached) {
                toast.success("Resume updated successfully!");
              } else {
                toast.success("Resume uploaded! Processing in background.");
              }
            } catch (claimError) {
              console.error("Returning user claim error:", claimError);
              toast.error(
                claimError instanceof Error ? claimError.message : "Failed to process upload",
              );
            }

            // Clear storage regardless of claim success
            sessionStorage.removeItem("temp_upload");
            sessionStorage.removeItem("temp_file_hash");
            await clearPendingUploadCookie();
          }

          router.push("/dashboard");
          return;
        }

        if (tempKey && !hasClaimedRef.current) {
          // Mark as claimed to prevent double-claiming on useEffect re-run
          hasClaimedRef.current = true;

          // Claim the upload (include file_hash for deduplication caching)
          setLoading(true);
          try {
            const claimResponse = await fetch("/api/resume/claim", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: tempKey, file_hash: fileHash }),
            });

            const claimData = (await claimResponse.json()) as ClaimResponse;

            if (!claimResponse.ok) {
              throw new Error(claimData.error || "Failed to claim resume");
            }

            // Validate that resume_id was returned
            if (!claimData.resume_id) {
              throw new Error("Server error: No resume ID returned");
            }

            // Get resume_id from claim response
            const resumeId = claimData.resume_id;

            // Clear sessionStorage after successful claim (migration cleanup)
            sessionStorage.removeItem("temp_upload");
            sessionStorage.removeItem("temp_file_hash");

            // Clear HTTP-only cookie after successful claim
            await clearPendingUploadCookie();

            // If not cached, wait for status updates (WS-first with polling fallback)
            if (!claimData.cached) {
              const parsingComplete = await awaitResumeComplete(resumeId);

              if (!parsingComplete) {
                return;
              }
            }
            // If cached, skip waiting - site_data already populated
          } catch (claimError) {
            console.error("Claim error:", claimError);
            setError(claimError instanceof Error ? claimError.message : "Failed to claim resume");

            // Clean up both storage mechanisms on error
            sessionStorage.removeItem("temp_upload");
            sessionStorage.removeItem("temp_file_hash");
            await clearPendingUploadCookie();

            // Reset claim ref on error to allow retry
            hasClaimedRef.current = false;

            setTimeout(() => router.push("/dashboard"), 3000);
            return;
          }
        }

        // Fetch site_data via API
        const siteDataResponse = await fetch("/api/site-data");
        if (siteDataResponse.ok) {
          const siteData = (await siteDataResponse.json()) as SiteDataResponse | null;

          if (siteData?.content) {
            const content = siteData.content as ResumeContent;

            // Load resume data into state
            setState((prev) => ({
              ...prev,
              resumeData: content,
            }));
            setLoading(false);
            return;
          }
        }

        // No site_data found - check for processing resume
        const statusResponse = await fetch("/api/resume/latest-status");
        if (statusResponse.ok) {
          const resume = (await statusResponse.json()) as LatestResumeResponse | null;

          if (resume?.status === "processing" && resume.id) {
            router.push(`/waiting?resume_id=${resume.id}`);
            return;
          }
        }

        // No resume OR failed status -> show upload step
        setNeedsUpload(true);
        setLoading(false);
      } catch (err) {
        console.error("Error initializing wizard:", err);
        setError("Failed to load resume data. Please try again.");
        setLoading(false);
      } finally {
        // Reset initializing flag when done (success or failure)
        initializingRef.current = false;
      }
    };

    initializeWizard();
    // No cleanup needed — waitForResumeCompletion handles its own cleanup internally
  }, [router, userId, sessionLoading, awaitResumeComplete, onboardingCompleted]);

  // Handler for upload completion (Step 1 for login-first users)
  // Note: We keep needsUpload=true to maintain correct step numbering throughout the session
  const handleUploadComplete = (resumeData: ResumeContent) => {
    setState((prev) => ({
      ...prev,
      resumeData,
      currentStep: 2, // Move to Handle step (step 2 in 5-step flow)
    }));
  };

  // Handler for handle selection
  const handleHandleContinue = (handle: string) => {
    setState((prev) => ({
      ...prev,
      handle,
      currentStep: needsUpload ? 3 : 2,
    }));
  };

  // Handler for review continue
  const handleReviewContinue = () => {
    setState((prev) => ({ ...prev, currentStep: needsUpload ? 4 : 3 }));
  };

  // Handler for privacy settings
  const handlePrivacyContinue = (settings: { show_phone: boolean; show_address: boolean }) => {
    setState((prev) => ({
      ...prev,
      privacySettings: settings,
      currentStep: needsUpload ? 5 : 4,
    }));
  };

  // Handler for wizard completion
  const handleThemeContinue = async (themeId: ThemeId) => {
    try {
      // Update local state
      setState((prev) => ({
        ...prev,
        themeId,
      }));

      // Call wizard completion API
      const response = await fetch("/api/wizard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: state.handle,
          privacy_settings: state.privacySettings,
          theme_id: themeId,
        }),
      });

      const data = (await response.json()) as WizardCompleteResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to complete setup");
      }

      // Show celebration! 🎉
      setShowCelebration(true);
      setShowLiveModal(true);
    } catch (err) {
      console.error("Error completing wizard:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to complete setup";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  // Handle modal close - redirect to dashboard
  const handleLiveModalClose = (open: boolean) => {
    setShowLiveModal(open);
    if (!open) {
      router.push("/dashboard");
    }
  };

  // Calculate progress percentage
  const progress = (state.currentStep / totalSteps) * 100;

  // Loading state (including session loading)
  if (loading || sessionLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-indigo-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading your resume...</p>
          <p className="text-slate-500 text-sm mt-2">
            This may take 30-60 seconds if we&apos;re parsing your PDF
          </p>
        </div>
      </div>
    );
  }

  // Error state (only for actual errors, not for "no resume" case which is handled by UploadStep)
  if (error && !needsUpload && state.currentStep === 1) {
    return (
      <div className="min-h-screen bg-linear-to-br from-indigo-50 via-blue-50 to-cyan-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-depth-md border border-red-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
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
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Something Went Wrong</h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  // Main wizard UI
  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 via-blue-50 to-cyan-50">
      {/* Celebration Effects */}
      {showCelebration && <Confetti />}
      <YouAreLiveModal
        open={showLiveModal}
        onOpenChange={handleLiveModalClose}
        handle={state.handle}
      />

      {/* Progress Indicator */}
      <WizardProgress
        currentStep={state.currentStep}
        totalSteps={totalSteps}
        progress={progress}
        hasUploadStep={needsUpload}
      />

      {/* Step Content */}
      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* Error Alert (shown inline for steps 2+) */}
        {error && state.currentStep > 1 && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-900">{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Upload (only when needsUpload) */}
        {needsUpload && state.currentStep === 1 && <UploadStep onContinue={handleUploadComplete} />}

        {/* Handle Selection - Step 2 if needsUpload, Step 1 otherwise */}
        {state.currentStep === (needsUpload ? 2 : 1) && (
          <HandleStep initialHandle={state.handle} onContinue={handleHandleContinue} />
        )}

        {/* Content Review - Step 3 if needsUpload, Step 2 otherwise */}
        {state.currentStep === (needsUpload ? 3 : 2) && state.resumeData && (
          <ReviewStep content={state.resumeData} onContinue={handleReviewContinue} />
        )}

        {/* Privacy Settings - Step 4 if needsUpload, Step 3 otherwise */}
        {state.currentStep === (needsUpload ? 4 : 3) && state.resumeData && (
          <PrivacyStep
            content={state.resumeData}
            initialSettings={state.privacySettings}
            onContinue={handlePrivacyContinue}
          />
        )}

        {/* Theme Selection - Step 5 if needsUpload, Step 4 otherwise */}
        {state.currentStep === (needsUpload ? 5 : 4) && (
          <ThemeStep initialTheme={state.themeId} onContinue={handleThemeContinue} />
        )}
      </main>
    </div>
  );
}
