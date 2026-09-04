"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ResumeStatus } from "@/lib/db/schema";
import { isValidResumeStatus, POLL_INTERVAL_MS } from "@/lib/realtime/constants";
import { classifyError, getErrorMessage, showErrorToast } from "@/lib/utils/errors";
import { useResumeWebSocket } from "./useResumeWebSocket";

interface ResumeStatusResponse {
  status: ResumeStatus;
  progress_pct: number;
  error: string | null;
  can_retry: boolean;
}

interface UseResumeStatusReturn {
  status: ResumeStatus | null;
  progress: number;
  error: string | null;
  canRetry: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useResumeStatus(resumeId: string | null): UseResumeStatusReturn {
  const [status, setStatus] = useState<ResumeStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const hasTimedOutRef = useRef(false);
  const retryCountRef = useRef(0);
  const fetchStatusRef = useRef<(() => Promise<void>) | null>(null);

  const handleWSStatus = useCallback((newStatus: ResumeStatus, wsError?: string) => {
    if (!isValidResumeStatus(newStatus)) return;
    setStatus(newStatus);
    if (wsError) {
      setError(wsError);
    }

    if (newStatus === "pending_claim") {
      setProgress(15);
    } else if (newStatus === "queued") {
      setProgress(25);
    } else if (newStatus === "waiting_for_cache") {
      setProgress(30);
    } else if (newStatus === "processing") {
      setProgress(50);
    } else if (newStatus === "completed") {
      setProgress(100);
    } else if (newStatus === "failed") {
      setProgress(0);
      void fetchStatusRef.current?.();
    }

    if (newStatus === "completed" || newStatus === "failed") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsLoading(false);
    }
  }, []);

  const { connectionState } = useResumeWebSocket({
    resumeId,
    onStatusChange: handleWSStatus,
  });

  const fetchStatus = useCallback(async () => {
    if (!resumeId) {
      setIsLoading(false);
      return;
    }

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      const response = await fetch(`/api/resume/status?resume_id=${resumeId}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized. Please log in again.");
        }
        if (response.status === 404) {
          throw new Error("Resume not found.");
        }
        throw new Error("Failed to fetch status");
      }

      const data: ResumeStatusResponse = await response.json();

      setStatus(data.status);
      setProgress(data.progress_pct);
      setError(data.error);
      setCanRetry(data.can_retry);
      setIsLoading(false);

      if (data.status !== "processing") {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }

      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed > 90000 && data.status === "processing" && !hasTimedOutRef.current) {
        hasTimedOutRef.current = true;
        setError("Processing is taking longer than expected. Please check back in a moment.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      // SAFETY: err is Error-like with optional status from fetch throw; cast narrows to status for error classification.
      const httpStatus =
        (err as { status?: number })?.status || (err instanceof Response ? err.status : 0);
      const category = classifyError(httpStatus);

      console.error("Error fetching resume status:", err);

      if (category === "fatal" || category === "auth") {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setError(getErrorMessage(httpStatus, "checking resume status"));
        showErrorToast(httpStatus, "checking resume status");
        setIsLoading(false);
      } else {
        retryCountRef.current++;
        if (retryCountRef.current >= 5) {
          setError("Unable to check status. Please refresh the page.");
          showErrorToast(0, "checking resume status");
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsLoading(false);
        }
      }
    }
  }, [resumeId]);

  fetchStatusRef.current = fetchStatus;

  useEffect(() => {
    if (!resumeId) {
      setIsLoading(false);
      return;
    }

    startTimeRef.current = Date.now();
    hasTimedOutRef.current = false;
    retryCountRef.current = 0;
    setIsLoading(true);

    void fetchStatus();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [resumeId, fetchStatus]);

  useEffect(() => {
    if (connectionState === "fallback" && resumeId && !intervalRef.current) {
      intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
    }

    if (connectionState === "connected" && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [connectionState, resumeId, fetchStatus]);

  return {
    status,
    progress,
    error,
    canRetry,
    isLoading,
    refetch: fetchStatus,
  };
}
