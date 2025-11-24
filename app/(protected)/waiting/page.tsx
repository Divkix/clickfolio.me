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

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useResumeStatus } from "@/hooks/useResumeStatus";

function WaitingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resume_id");

  const { status, progress, error, canRetry, isLoading, refetch } = useResumeStatus(resumeId);

  // Redirect to dashboard if no resume_id
  useEffect(() => {
    if (!resumeId) {
      router.push("/dashboard");
    }
  }, [resumeId, router]);

  // Auto-redirect on completion with delay for user feedback
  useEffect(() => {
    if (status === "completed") {
      const timeout = setTimeout(() => {
        router.push("/dashboard");
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [status, router]);

  // Handle retry
  const handleRetry = async () => {
    if (!resumeId) return;

    try {
      const response = await fetch("/api/resume/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_id: resumeId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to retry");
      }

      // Trigger immediate refetch to start polling again
      await refetch();
    } catch (err) {
      console.error("Retry failed:", err);
      alert(err instanceof Error ? err.message : "Failed to retry parsing");
    }
  };

  if (!resumeId) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {status === "completed" ? "Resume Ready!" : "Analyzing Your Resume"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && !status && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Connecting...</p>
            </div>
          )}

          {status === "processing" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-4 space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium">Processing your resume with AI</p>
                  <p className="text-xs text-muted-foreground">This usually takes 30-40 seconds</p>
                </div>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-center text-muted-foreground">{progress}% complete</p>
            </div>
          )}

          {status === "completed" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-medium text-green-900">Parsing Complete!</p>
                <p className="text-sm text-muted-foreground">Redirecting to your dashboard...</p>
              </div>
            </div>
          )}

          {status === "failed" && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">Processing Failed</p>
                  <p className="text-sm mt-1">{error || "Unknown error occurred"}</p>
                </AlertDescription>
              </Alert>

              <div className="flex flex-col gap-2">
                {canRetry && (
                  <Button onClick={handleRetry} className="w-full">
                    Try Again
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                  className="w-full"
                >
                  Go to Dashboard
                </Button>
              </div>
            </div>
          )}

          {error && status === "processing" && (
            <Alert>
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
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <WaitingContent />
    </Suspense>
  );
}
