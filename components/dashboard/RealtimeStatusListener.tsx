"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useResumeWebSocket } from "@/hooks/useResumeWebSocket";

interface RealtimeStatusListenerProps {
  resumeId: string;
  userId: string;
  currentStatus: string;
}

type DetectedState = {
  status: "processing" | "completed" | "failed";
  errorMessage?: string;
};

/**
 * Status listener component that uses WebSocket for real-time resume status changes.
 * Falls back to polling automatically via useResumeWebSocket.
 */
export function RealtimeStatusListener({ resumeId, currentStatus }: RealtimeStatusListenerProps) {
  const hasRefreshedRef = useRef(false);
  const refreshDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [detected, setDetected] = useState<DetectedState>({
    status:
      currentStatus === "processing" || currentStatus === "queued"
        ? "processing"
        : (currentStatus as DetectedState["status"]),
  });

  const handleStatusChange = useCallback((newStatus: string, errorMessage?: string) => {
    if (hasRefreshedRef.current) return;
    if (newStatus === "completed" || newStatus === "failed") {
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

  // Connect WebSocket only when currently processing
  useResumeWebSocket({
    resumeId: currentStatus === "processing" || currentStatus === "queued" ? resumeId : null,
    onStatusChange: handleStatusChange,
  });

  if (detected.status === "completed") {
    return (
      <div className="rounded-lg border border-mint bg-mint/5 p-4 mb-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-mint shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Processing Complete!</h3>
            <p className="mt-1 text-sm text-foreground/80">
              Your resume has been processed. Refreshing page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (detected.status === "failed") {
    return (
      <div className="rounded-lg border border-coral/30 bg-coral/10 p-4 mb-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-coral shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-coral">Processing Failed</h3>
            <p className="mt-1 text-sm text-coral">
              {detected.errorMessage || "An error occurred while processing your resume."}
            </p>
            <p className="mt-2 text-xs text-coral">Refreshing page...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-coral/30 bg-coral/10 p-4 mb-4">
      <div className="flex items-start gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-coral shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-coral">Processing Your Resume</h3>
          <p className="mt-1 text-sm text-coral">
            Our AI is analyzing your resume. This usually takes 30-40 seconds.
          </p>
          <p className="mt-2 text-xs text-coral">
            This page will automatically refresh when processing completes.
          </p>
        </div>
      </div>
    </div>
  );
}
