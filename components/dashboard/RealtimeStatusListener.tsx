"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useResumeWebSocket } from "@/hooks/useResumeWebSocket";
import type { ResumeStatus } from "@/lib/db/schema/resume";

interface RealtimeStatusListenerProps {
  resumeId: string;
  currentStatus: ResumeStatus;
}

type DetectedState = {
  status: "processing" | "completed" | "failed";
  errorMessage?: string;
};

/**
 * Status listener component that uses WebSocket for real-time resume status changes.
 *
 * Updates arrive exclusively via WebSocket push: this component does not
 * consume useResumeWebSocket's connectionState, so when the hook exhausts
 * its reconnect budget (connectionState "fallback") NO polling happens here.
 * The page still recovers via the server render / router.refresh() once a
 * terminal status is delivered over WS.
 */
export function RealtimeStatusListener({ resumeId, currentStatus }: RealtimeStatusListenerProps) {
  const router = useRouter();
  const hasRefreshedRef = useRef(false);
  const refreshDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [detected, setDetected] = useState<DetectedState>({
    status:
      currentStatus === "completed" || currentStatus === "failed" ? currentStatus : "processing",
  });

  const handleStatusChange = useCallback(
    (newStatus: ResumeStatus, errorMessage?: string) => {
      if (hasRefreshedRef.current) return;
      if (newStatus === "completed" || newStatus === "failed") {
        if (refreshDebounceRef.current) {
          clearTimeout(refreshDebounceRef.current);
        }
        setDetected({
          status: newStatus,
          errorMessage,
        });

        refreshDebounceRef.current = setTimeout(() => {
          if (hasRefreshedRef.current) return;
          hasRefreshedRef.current = true;
          router.refresh();
        }, 200);
      }
    },
    [router],
  );

  // Clear the debounce timer on unmount so a pending refresh can't fire
  // after the component is gone (state update on unmounted component / leak).
  useEffect(() => {
    return () => {
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = null;
      }
    };
  }, []);

  // Connect WebSocket only when currently processing
  useResumeWebSocket({
    resumeId: currentStatus === "processing" || currentStatus === "queued" ? resumeId : null,
    onStatusChange: handleStatusChange,
  });

  if (detected.status === "completed") {
    return (
      <div className="rounded-lg border border-success/30 bg-success/10 p-4 mb-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Processing Complete!</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your resume has been processed. Refreshing page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (detected.status === "failed") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 mb-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <h3 className="font-semibold text-destructive">Processing Failed</h3>
            <p className="mt-1 text-sm text-destructive">
              {detected.errorMessage || "An error occurred while processing your resume."}
            </p>
            <p className="mt-2 text-xs text-destructive">Refreshing page...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-info/30 bg-info/10 p-4 mb-4">
      <div className="flex items-start gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-info shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <h3 className="font-semibold text-info">Processing Your Resume</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Our AI is analyzing your resume. This usually takes 30-40 seconds.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            This page will automatically refresh when processing completes.
          </p>
        </div>
      </div>
    </div>
  );
}
