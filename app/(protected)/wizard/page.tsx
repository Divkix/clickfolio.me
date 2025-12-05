"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WizardProgress } from "@/components/wizard";
import { HandleStep } from "@/components/wizard/HandleStep";
import { PrivacyStep } from "@/components/wizard/PrivacyStep";
import { ReviewStep } from "@/components/wizard/ReviewStep";
import { ThemeStep } from "@/components/wizard/ThemeStep";
import { UploadStep } from "@/components/wizard/UploadStep";
import { createClient } from "@/lib/supabase/client";
import type { ThemeId } from "@/lib/templates/theme-registry";
import type { ResumeContent } from "@/lib/types/database";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsUpload, setNeedsUpload] = useState(false);

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

  // Fetch resume data on mount + handle upload claiming
  useEffect(() => {
    const initializeWizard = async () => {
      try {
        setLoading(true);
        const supabase = createClient();

        // 1. Check authentication
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/");
          return;
        }

        // 2. Check for pending upload claim
        const tempKey = localStorage.getItem("temp_upload_key");
        if (tempKey) {
          // Claim the upload (include file_hash for deduplication caching)
          // Use sessionStorage for file_hash to avoid multi-tab race conditions
          const fileHash = sessionStorage.getItem("temp_file_hash");
          setLoading(true);
          try {
            const claimResponse = await fetch("/api/resume/claim", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: tempKey, file_hash: fileHash }),
            });

            const claimData = await claimResponse.json();

            if (!claimResponse.ok) {
              throw new Error(claimData.error || "Failed to claim resume");
            }

            // Validate that resume_id was returned
            if (!claimData?.resume_id) {
              throw new Error("Server error: No resume ID returned");
            }

            // Get resume_id from claim response
            const resumeId = claimData.resume_id;

            // Clear localStorage and sessionStorage after successful claim
            localStorage.removeItem("temp_upload_key");
            sessionStorage.removeItem("temp_file_hash");

            // If not cached, wait for Realtime updates (parsing in progress)
            if (!claimData.cached) {
              // Subscribe to Realtime updates for this resume
              const parsingComplete = await new Promise<boolean>((resolve) => {
                const timeoutId: { current: NodeJS.Timeout | null } = {
                  current: null,
                };

                const channel = supabase
                  .channel(`wizard-resume-${resumeId}`)
                  .on(
                    "postgres_changes",
                    {
                      event: "UPDATE",
                      schema: "public",
                      table: "resumes",
                      filter: `id=eq.${resumeId}`,
                    },
                    (payload) => {
                      const newStatus = payload.new?.status;

                      if (newStatus === "completed") {
                        if (timeoutId.current) clearTimeout(timeoutId.current);
                        channel.unsubscribe();
                        supabase.removeChannel(channel);
                        resolve(true);
                      }

                      if (newStatus === "failed") {
                        if (timeoutId.current) clearTimeout(timeoutId.current);
                        channel.unsubscribe();
                        supabase.removeChannel(channel);
                        setError(
                          payload.new?.error_message || "Resume parsing failed. Please try again.",
                        );
                        setTimeout(() => router.push("/dashboard"), 3000);
                        resolve(false);
                      }
                    },
                  )
                  .subscribe();

                // Timeout after 90 seconds
                timeoutId.current = setTimeout(() => {
                  channel.unsubscribe();
                  supabase.removeChannel(channel);
                  router.push(`/waiting?resume_id=${resumeId}`);
                  resolve(false);
                }, 90000);
              });

              if (!parsingComplete) {
                return;
              }
            }
            // If cached, skip waiting - site_data already populated
          } catch (claimError) {
            console.error("Claim error:", claimError);
            setError(claimError instanceof Error ? claimError.message : "Failed to claim resume");
            localStorage.removeItem("temp_upload_key");
            sessionStorage.removeItem("temp_file_hash");
            setTimeout(() => router.push("/dashboard"), 3000);
            return;
          }
        }

        // 3. Fetch site_data (contains parsed resume content)
        const { data: siteData } = await supabase
          .from("site_data")
          .select("content")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!siteData) {
          const { data: resume } = await supabase
            .from("resumes")
            .select("id, status")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (resume?.status === "processing") {
            router.push(`/waiting?resume_id=${resume.id}`);
            return;
          }

          // No resume OR failed status → show upload step
          setNeedsUpload(true);
          setLoading(false);
          return;
        }

        const content = siteData.content as unknown as ResumeContent;

        // 4. Load resume data into state
        setState((prev) => ({
          ...prev,
          resumeData: content,
        }));
      } catch (err) {
        console.error("Error initializing wizard:", err);
        setError("Failed to load resume data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    initializeWizard();
  }, [router]);

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to complete setup");
      }

      // Show success message and redirect
      toast.success("Profile setup completed successfully!");
      router.push("/dashboard");
    } catch (err) {
      console.error("Error completing wizard:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to complete setup";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  // Calculate progress percentage
  const progress = (state.currentStep / totalSteps) * 100;

  // Loading state
  if (loading) {
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
