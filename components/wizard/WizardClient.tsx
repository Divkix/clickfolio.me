"use client";

import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WizardProgress } from "@/components/wizard";
import { HandleStep } from "@/components/wizard/HandleStep";
import { PrivacyStep } from "@/components/wizard/PrivacyStep";
import { ReviewStep } from "@/components/wizard/ReviewStep";
import { ThemeStep } from "@/components/wizard/ThemeStep";
import { UploadStep } from "@/components/wizard/UploadStep";
import { YouAreLiveModal } from "@/components/YouAreLiveModal";
import { DEFAULT_THEME, type ThemeId } from "@/lib/templates/theme-ids";
import type { ResumeContent } from "@/lib/types/database";
import { clearDesiredHandle, readDesiredHandle } from "@/lib/utils/desired-handle";
import { clearPendingUploadCookie } from "@/lib/utils/pending-upload-client";
import { runClaimThenLoad, type WizardStart } from "@/lib/wizard/initial-step";

interface WizardCompleteResponse {
  success?: boolean;
  error?: string;
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

function WizardLoading() {
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

function WizardError({ message }: { message: string }) {
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
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function initialStepId(kind: WizardStart["kind"], ownerHandle: string | null): WizardStepId {
  switch (kind) {
    case "upload":
      return "upload";
    case "review":
      return ownerHandle ? "review" : "handle";
    default:
      return "handle";
  }
}

function useWizardInit(
  initialStart: Exclude<WizardStart, { kind: "redirect-waiting" }>,
  ownerHandle: string | null,
) {
  const router = useRouter();
  const [loading, setLoading] = useState(initialStart.kind === "claim-first");
  const [error, setError] = useState<string | null>(null);
  const [needsUpload, setNeedsUpload] = useState(initialStart.kind === "upload");
  const claimRef = useRef<Promise<WizardStart> | null>(null);
  const navigateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // An owner who already has a handle skips straight to review, unless they typed a new one on the home page.
  const contentStepRef = useRef<WizardStepId>(ownerHandle ? "review" : "handle");

  const [state, setState] = useState<WizardState>({
    currentStepId: initialStepId(initialStart.kind, ownerHandle),
    resumeData: initialStart.kind === "review" ? initialStart.content : null,
    handle: ownerHandle ?? "",
    privacySettings: {
      show_phone: false,
      show_address: false,
      show_in_directory: true,
      hide_from_search: false,
    },
    themeId: DEFAULT_THEME,
  });

  useEffect(() => {
    const desiredHandle = readDesiredHandle();

    if (desiredHandle && desiredHandle !== ownerHandle) {
      contentStepRef.current = "handle";
      setState((prev) => ({
        ...prev,
        handle: desiredHandle,
        currentStepId: prev.currentStepId === "review" ? "handle" : prev.currentStepId,
      }));
    }
  }, [ownerHandle]);

  useEffect(() => {
    if (initialStart.kind !== "claim-first") return;

    let active = true;
    // Keep the write alive across StrictMode's effect cleanup; both mounts share one claim.
    const claim = (claimRef.current ??= runClaimThenLoad(initialStart.pendingUpload));

    void (async () => {
      try {
        const start = await claim;

        if (!active) return;

        if (start.kind === "redirect-waiting") {
          router.push(`/waiting?resume_id=${start.resumeId}`);

          return;
        }

        if (start.kind === "review") {
          setState((prev) => ({
            ...prev,
            resumeData: start.content,
            currentStepId: contentStepRef.current,
          }));
        } else {
          setNeedsUpload(true);
          setState((prev) => ({ ...prev, currentStepId: "upload" }));
        }

        setLoading(false);
      } catch (claimError) {
        if (!active) return;

        log("error", "Claim error:", { ...errorFields(claimError) });
        setError(claimError instanceof Error ? claimError.message : "Failed to claim resume");
        setLoading(false);
        await clearPendingUploadCookie();

        if (!active) return;

        navigateTimeoutRef.current = setTimeout(() => router.push("/dashboard"), 3000);
      }
    })();

    return () => {
      active = false;

      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current);
        navigateTimeoutRef.current = null;
      }
    };
  }, [initialStart, router]);

  return { router, loading, error, setError, needsUpload, state, setState };
}

export default function WizardClient({
  initialStart,
  ownerHandle,
}: {
  initialStart: Exclude<WizardStart, { kind: "redirect-waiting" }>;
  ownerHandle: string | null;
}) {
  const { router, loading, error, setError, needsUpload, state, setState } = useWizardInit(
    initialStart,
    ownerHandle,
  );

  const [showLiveModal, setShowLiveModal] = useState(false);

  const stepOrder = getStepOrder(needsUpload);
  const totalSteps = stepOrder.length;
  const currentStepNumber = stepOrder.indexOf(state.currentStepId) + 1;
  const progress = (currentStepNumber / totalSteps) * 100;

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
    clearDesiredHandle();

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
      log("error", "Error completing wizard:", { ...errorFields(err) });
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

  if (loading) {
    return <WizardLoading />;
  }

  if (error && state.currentStepId === "handle" && !needsUpload) {
    return <WizardError message={error} />;
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
          <HandleStep
            key={state.handle}
            initialHandle={state.handle}
            onContinue={handleHandleContinue}
          />
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
