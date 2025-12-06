"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface RealtimeStatusListenerProps {
  resumeId: string;
  userId: string;
  currentStatus: string;
}

type DetectedState = {
  status: "processing" | "completed" | "failed";
  errorMessage?: string;
};

interface ResumeStatusResponse {
  status: "pending_claim" | "processing" | "completed" | "failed";
  progress_pct?: number;
  error?: string | null;
  can_retry?: boolean;
}

/**
 * Status listener component that polls the API for resume status changes.
 */
export function RealtimeStatusListener({ resumeId, currentStatus }: RealtimeStatusListenerProps) {
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasRefreshedRef = useRef(false);
  const refreshDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [detected, setDetected] = useState<DetectedState>({
    status:
      currentStatus === "processing" ? "processing" : (currentStatus as DetectedState["status"]),
  });

  const handleStatusChange = useCallback((newStatus: string, errorMessage?: string) => {
    if (hasRefreshedRef.current) return;
    if (newStatus === "completed" || newStatus === "failed") {
      // Debounce to prevent race condition
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
      }

      setDetected({
        status: newStatus as "completed" | "failed",
        errorMessage,
      });

      refreshDebounceRef.current = setTimeout(() => {
        if (hasRefreshedRef.current) return;
        hasRefreshedRef.current = true;
        window.location.reload();
      }, 200);
    }
  }, []);

  useEffect(() => {
    // Only poll if status is processing
    if (currentStatus !== "processing") {
      return;
    }

    // Poll status via API
    const pollStatus = async () => {
      if (hasRefreshedRef.current) return;
      try {
        const response = await fetch(`/api/resume/status?resume_id=${resumeId}`);
        if (!response.ok) return;

        const data = (await response.json()) as ResumeStatusResponse;

        if (data.status && data.status !== currentStatus) {
          handleStatusChange(data.status, data.error ?? undefined);
        }
      } catch {
        // Ignore polling errors
      }
    };

    // Poll immediately, then every 3 seconds
    pollStatus();
    pollIntervalRef.current = setInterval(pollStatus, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
      }
    };
  }, [resumeId, currentStatus, handleStatusChange]);

  if (detected.status === "completed") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 mb-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-green-900">Processing Complete!</h3>
            <p className="mt-1 text-sm text-green-700">
              Your resume has been processed. Refreshing page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (detected.status === "failed") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Processing Failed</h3>
            <p className="mt-1 text-sm text-red-700">
              {detected.errorMessage || "An error occurred while processing your resume."}
            </p>
            <p className="mt-2 text-xs text-red-600">Refreshing page...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-4">
      <div className="flex items-start gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600 shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900">Processing Your Resume</h3>
          <p className="mt-1 text-sm text-blue-700">
            Our AI is analyzing your resume. This usually takes 30-40 seconds.
          </p>
          <p className="mt-2 text-xs text-blue-600">
            This page will automatically refresh when processing completes.
          </p>
        </div>
      </div>
    </div>
  );
}
