"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { classifyError, getErrorMessage, showErrorToast } from "@/lib/utils/errors";
import { useResumeWebSocket } from "./useResumeWebSocket";

interface ResumeStatus {
  status: "pending_claim" | "processing" | "completed" | "failed";
  progress_pct: number;
  error: string | null;
  can_retry: boolean;
}

interface UseResumeStatusReturn {
  status: ResumeStatus["status"] | null;
  progress: number;
  error: string | null;
  canRetry: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to monitor resume parsing status.
 *
 * Uses WebSocket (via ResumeStatusDO) as primary channel for instant push
 * notifications. Falls back to 3s HTTP polling if WebSocket fails to connect
 * after 3 attempts.
 *
 * @param resumeId - Resume ID to check status for (null to disable)
 * @returns Status state and refetch function
 */
export function useResumeStatus(resumeId: string | null): UseResumeStatusReturn {
  const [status, setStatus] = useState<ResumeStatus["status"] | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const hasTimedOutRef = useRef(false);
  const retryCountRef = useRef(0);

  // Handle status updates from WebSocket
  const handleWSStatus = useCallback((newStatus: string, wsError?: string) => {
    const s = newStatus as ResumeStatus["status"];
    setStatus(s);
    if (wsError) {
      setError(wsError);
    }

    // Map status to progress percentage
    if (s === "processing") {
      setProgress(50);
    } else if (s === "completed") {
      setProgress(100);
    } else if (s === "failed") {
      setCanRetry(true);
    }

    // Terminal state — stop any polling that might be running
    if (s === "completed" || s === "failed") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsLoading(false);
    }
  }, []);

  // WebSocket connection
  const { connectionState } = useResumeWebSocket({
    resumeId,
    onStatusChange: handleWSStatus,
  });

  // Memoize fetchStatus for HTTP polling
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

      const data: ResumeStatus = await response.json();

      setStatus(data.status);
      setProgress(data.progress_pct);
      setError(data.error);
      setCanRetry(data.can_retry);
      setIsLoading(false);

      // Stop polling if terminal state reached
      if (data.status !== "processing") {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }

      // Check for timeout (90 seconds)
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed > 90000 && data.status === "processing" && !hasTimedOutRef.current) {
        hasTimedOutRef.current = true;
        setError("Processing is taking longer than expected. Please check back in a moment.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

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

  // Initial HTTP fetch for immediate state population + polling fallback
  useEffect(() => {
    if (!resumeId) {
      setIsLoading(false);
      return;
    }

    // Reset state
    startTimeRef.current = Date.now();
    hasTimedOutRef.current = false;
    retryCountRef.current = 0;
    setIsLoading(true);

    // Always do an initial HTTP fetch for immediate state
    fetchStatus();

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

  // Start polling fallback when WebSocket gives up
  useEffect(() => {
    if (connectionState === "fallback" && resumeId && !intervalRef.current) {
      intervalRef.current = setInterval(fetchStatus, 3000);
    }

    // If WS connects successfully, stop any polling
    if (connectionState === "connected" && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
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
