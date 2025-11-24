"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
 * Custom hook to poll resume parsing status
 * @param resumeId - Resume ID to check status for (null to disable polling)
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

  // Memoize fetchStatus with only resumeId as dependency
  const fetchStatus = useCallback(async () => {
    if (!resumeId) {
      setIsLoading(false);
      return;
    }

    try {
      // Cancel previous request if still pending
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
        // Don't stop polling - just show warning
      }
    } catch (err) {
      // Ignore abort errors (expected during cleanup or re-fetch)
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      console.error("Error fetching resume status:", err);
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
      setIsLoading(false);

      // Stop polling on errors
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [resumeId]); // Only depend on resumeId - this is now stable

  // Start polling on mount or when resumeId changes
  useEffect(() => {
    if (!resumeId) {
      setIsLoading(false);
      return;
    }

    // Reset state
    startTimeRef.current = Date.now();
    hasTimedOutRef.current = false;
    setIsLoading(true);

    // Fetch immediately
    fetchStatus();

    // Poll every 3 seconds
    intervalRef.current = setInterval(fetchStatus, 3000);

    // Cleanup on unmount or when resumeId changes
    return () => {
      // Clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Abort pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [resumeId, fetchStatus]); // fetchStatus is now stable via useCallback

  return {
    status,
    progress,
    error,
    canRetry,
    isLoading,
    refetch: fetchStatus,
  };
}
