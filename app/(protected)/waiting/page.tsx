"use client";

/**
 * Waiting Room - Error Fallback Page
 *
 * This page is primarily used as a fallback for error cases and retries.
 * Normal flow: Upload → Login → Onboarding → Survey → Dashboard
 * This page is accessed only when:
 * - Resume parsing fails and user needs to retry
 * - Manual navigation or old bookmarks
 * - Error recovery scenarios
 *
 * Dashboard already handles live status updates for processing resumes.
 */

import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  FileText,
  Layout,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useResumeStatus } from "@/hooks/useResumeStatus";

interface RetryResponse {
  success?: boolean;
  error?: string;
}

const PROCESSING_STAGES = [
  {
    progress: 20,
    stage: "Extracting Text",
    message: "Reading your PDF and extracting all content...",
    icon: FileText,
  },
  {
    progress: 40,
    stage: "Finding Sections",
    message: "Identifying experience, education, and skills...",
    icon: Layout,
  },
  {
    progress: 60,
    stage: "Analyzing Experience",
    message: "Understanding your work history and achievements...",
    icon: Briefcase,
  },
  {
    progress: 80,
    stage: "Extracting Skills",
    message: "Identifying technical skills and competencies...",
    icon: Wrench,
  },
  {
    progress: 95,
    stage: "Final Touches",
    message: "Formatting your beautiful new portfolio...",
    icon: Sparkles,
  },
] as const;

const INITIAL_COUNTDOWN = 35;

function WaitingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resume_id");

  const { status, progress, error, canRetry, isLoading, refetch } = useResumeStatus(resumeId);

  const [countdown, setCountdown] = useState(INITIAL_COUNTDOWN);

  // Countdown timer
  useEffect(() => {
    if (status !== "processing") return;

    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Reset countdown when status changes to processing
  useEffect(() => {
    if (status === "processing") {
      setCountdown(INITIAL_COUNTDOWN);
    }
  }, [status]);

  // Redirect to dashboard if no resume_id
  useEffect(() => {
    if (!resumeId) {
      router.push("/dashboard");
    }
  }, [resumeId, router]);

  // Auto-redirect on completion with delay for user feedback
  // Redirect to /wizard to complete remaining onboarding steps (handle, privacy, theme)
  useEffect(() => {
    if (status !== "completed") return;

    const timeout = setTimeout(() => {
      router.push("/wizard");
    }, 2000);

    return () => clearTimeout(timeout);
  }, [status, router]);

  // Handle retry
  const handleRetry = useCallback(async () => {
    if (!resumeId) return;

    try {
      const response = await fetch("/api/resume/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_id: resumeId }),
      });

      if (!response.ok) {
        const data = (await response.json()) as RetryResponse;
        throw new Error(data.error || "Failed to retry");
      }

      // Reset countdown and trigger immediate refetch
      setCountdown(INITIAL_COUNTDOWN);
      await refetch();
    } catch (err) {
      console.error("Retry failed:", err);
      alert(err instanceof Error ? err.message : "Failed to retry parsing");
    }
  }, [resumeId, refetch]);

  if (!resumeId) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cream">
      <Card className="w-full max-w-md border-2 border-ink shadow-brutal-md bg-card">
        <CardHeader className="border-b-2 border-ink">
          <CardTitle className="text-center text-xl font-bold">
            {status === "completed" ? "Resume Ready!" : "Analyzing Your Resume"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {isLoading && !status && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="relative">
                <div className="absolute inset-0 animate-ping opacity-30 rounded-full bg-coral" />
                <Sparkles className="h-8 w-8 text-coral relative" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Connecting...</p>
            </div>
          )}

          {status === "processing" && (
            <div className="space-y-6">
              {/* Animated processing icon */}
              <div className="flex flex-col items-center justify-center py-4 space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 animate-pulse rounded-full bg-coral/20 scale-150" />
                  <div className="absolute inset-0 animate-ping opacity-20 rounded-full bg-coral" />
                  <div className="relative bg-cream border-2 border-ink rounded-full p-4 shadow-brutal-sm">
                    <Sparkles className="h-10 w-10 text-coral animate-pulse" />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-base font-bold">Processing your resume with AI</p>
                  <p className="text-sm text-muted-foreground">
                    {countdown > 0 ? `~${countdown} seconds remaining` : "Almost there..."}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <Progress value={progress} className="w-full h-3 border border-ink" />
                <p className="text-xs text-center text-muted-foreground font-medium">
                  {progress}% complete
                </p>
              </div>

              {/* Processing stage info */}
              <div className="border-2 border-ink bg-secondary/50 p-4 shadow-brutal-sm">
                <div className="space-y-3">
                  {(() => {
                    const currentStage =
                      PROCESSING_STAGES.find((s) => progress <= s.progress) ||
                      PROCESSING_STAGES[PROCESSING_STAGES.length - 1];
                    const StageIcon = currentStage.icon;
                    return (
                      <div className="flex items-center gap-3">
                        <div className="bg-coral/10 border border-coral/20 rounded-lg p-2">
                          <StageIcon className="h-5 w-5 text-coral" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-ink">{currentStage.stage}</p>
                          <p className="text-xs text-muted-foreground">{currentStage.message}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* What You'll Get preview */}
                <div className="mt-4 pt-4 border-t border-ink/10">
                  <p className="text-xs font-semibold text-ink/70 mb-2">What you&apos;ll get:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Your own clickfolio.me/@yourname URL</li>
                    <li>• Mobile-optimized design</li>
                    <li>• One-click sharing to LinkedIn</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {status === "completed" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="bg-mint/20 border-2 border-ink rounded-full p-4 shadow-brutal-sm">
                <CheckCircle2 className="h-10 w-10 text-mint" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-bold text-lg">Parsing Complete!</p>
                <p className="text-sm text-muted-foreground">Redirecting to setup wizard...</p>
              </div>
            </div>
          )}

          {status === "failed" && (
            <div className="space-y-4">
              <Alert variant="destructive" className="border-2 border-ink">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-bold">Processing Failed</p>
                  <p className="text-sm mt-1">{error || "Unknown error occurred"}</p>
                </AlertDescription>
              </Alert>

              <div className="flex flex-col gap-2">
                {canRetry && (
                  <Button
                    onClick={handleRetry}
                    className="w-full border-2 border-ink shadow-brutal-sm hover:shadow-brutal-md transition-shadow bg-coral text-white hover:bg-coral/90"
                  >
                    Try Again
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                  className="w-full border-2 border-ink shadow-brutal-sm hover:shadow-brutal-md transition-shadow"
                >
                  Go to Dashboard
                </Button>
              </div>
            </div>
          )}

          {error && status === "processing" && (
            <Alert className="border-2 border-ink">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function WaitingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-cream">
          <div className="relative">
            <div className="absolute inset-0 animate-ping opacity-30 rounded-full bg-coral" />
            <Sparkles className="h-8 w-8 text-coral relative animate-pulse" />
          </div>
        </div>
      }
    >
      <WaitingContent />
    </Suspense>
  );
}
