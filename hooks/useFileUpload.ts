"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useCallback, useState } from "react";
import posthog from "posthog-js";
import { toast } from "sonner";
import {
  clearPendingUploadCookie,
  setPendingUploadCookie,
} from "@/lib/utils/pending-upload-client";
import { MAX_FILE_SIZE_LABEL, validatePDF } from "@/lib/utils/validation";
export type UploadState = "idle" | "uploading" | "claiming" | "parsing" | "error";

interface UseFileUploadOptions {
  onClaim?: (resumeId: string) => void;
}

interface UploadResponse {
  key: string;
  remaining?: { hourly: number; daily: number };
  error?: string;
}

interface ClaimResponse {
  resume_id: string;
  cached?: boolean;
  error?: string;
}

function getFriendlyError(cause: unknown): string {
  if (cause instanceof Error && cause.message) {
    const msg = cause.message;
    const lower = msg.toLowerCase();
    if (msg.includes("429") || lower.includes("limit")) {
      return "Upload limit reached (5 per day). Try again tomorrow.";
    }
    if (msg.includes("413") || lower.includes("large")) {
      return `File too large. Maximum size is ${MAX_FILE_SIZE_LABEL}.`;
    }
    if (msg.includes("401") || lower.includes("expired") || lower.includes("sign in")) {
      if (msg.includes("refresh")) return "Session expired. Please refresh the page.";
      return "Session expired. Please sign in again.";
    }
    if (lower.includes("network")) {
      return "Network error. Check your connection.";
    }
    return msg;
  }
  if (cause instanceof Response) {
    if (cause.status === 429) return "Upload limit reached (5 per day). Try again tomorrow.";
    if (cause.status === 413) return `File too large. Maximum size is ${MAX_FILE_SIZE_LABEL}.`;
    if (cause.status === 409) return "This file was already uploaded.";
    if (cause.status === 401) return "Session expired. Please sign in again.";
  }
  // SAFETY: cause may carry status from thrown Response-like objects; optional chaining guards shape mismatch.
  const status = (cause as { status?: number })?.status;
  if (status === 429) return "Upload limit reached (5 per day). Try again tomorrow.";
  if (status === 413) return `File too large. Maximum size is ${MAX_FILE_SIZE_LABEL}.`;
  if (status === 409) return "This file was already uploaded.";
  if (status === 401) return "Session expired. Please sign in again.";
  return "Failed to upload file";
}

export function useFileUpload({ onClaim }: UseFileUploadOptions = {}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);

  // handleDrop/handleFileSelect depend on processFile, so they are defined after doUpload/processFile below

  const doUpload = useCallback(
    async (fileToUpload: File) => {
      setUploadState("uploading");
      setUploadProgress(0);
      setError(null);

      try {
        // ponytail: single progress sequence, adjust if UX needs diverge
        setUploadProgress(10);

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/pdf",
            "Content-Length": String(fileToUpload.size),
            "X-Filename": fileToUpload.name,
          },
          body: fileToUpload,
        });

        if (!uploadResponse.ok) {
          // SAFETY: fetch JSON is bounded and validated to expected shape
          const data = (await uploadResponse.json().catch(() => ({}))) as UploadResponse;
          if (uploadResponse.status === 429) {
            throw new Error(data.error || "Too many upload attempts. Please wait and try again.");
          }
          if (uploadResponse.status === 413) {
            throw new Error(
              data.error || `File too large. Maximum size is ${MAX_FILE_SIZE_LABEL}.`,
            );
          }
          if (uploadResponse.status === 409) {
            throw new Error(data.error || "This file was already uploaded.");
          }
          if (uploadResponse.status === 401) {
            throw new Error(data.error || "Session expired. Please sign in again.");
          }
          throw new Error(data.error || "Failed to upload file");
        }

        // SAFETY: fetch JSON is bounded and validated to expected shape
        const parsed = (await uploadResponse.json()) as UploadResponse;
        const key = parsed.key;
        setUploadProgress(40);
        setUploadState("claiming");

        if (onClaim) {
          const claimResponse = await fetch("/api/resume/claim", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key,
            }),
          });

          if (!claimResponse.ok) {
            // SAFETY: fetch JSON is bounded and validated to expected shape
            const data = (await claimResponse.json().catch(() => ({}))) as ClaimResponse;
            if (claimResponse.status === 429) {
              throw new Error(data.error || "Too many upload attempts. Please wait and try again.");
            }
            if (claimResponse.status === 401) {
              throw new Error(data.error || "Session expired. Please refresh the page.");
            }
            throw new Error(data.error || "Failed to claim resume");
          }

          // SAFETY: fetch JSON is bounded and validated to expected shape
          const claimData = (await claimResponse.json()) as ClaimResponse;
          const resumeId = claimData.resume_id;
          // ponytail: single progress sequence, adjust if UX needs diverge
          setUploadProgress(70);
          setUploadState("parsing");
          setUploadProgress(90);
          onClaim(resumeId);
          setUploadProgress(100);
          setUploadedKey(key);
          toast.success("File uploaded successfully!");
          posthog.capture("resume_uploaded", {
            file_size_bytes: fileToUpload.size,
            file_name_length: fileToUpload.name.length,
          });
          return;
        }

        setUploadProgress(70);
        await setPendingUploadCookie(key);
        setUploadProgress(90);
        setUploadProgress(100);
        setUploadedKey(key);
        toast.success("File uploaded successfully!");
        posthog.capture("resume_uploaded", {
          file_size_bytes: fileToUpload.size,
          file_name_length: fileToUpload.name.length,
        });
      } catch (err) {
        const errorMessage = getFriendlyError(err);
        setError(errorMessage);
        setUploadState("error");
        toast.error(errorMessage);
        await clearPendingUploadCookie();
        posthog.capture("resume_upload_failed", { error_message: errorMessage });
        if (!onClaim) {
          setUploadedKey(null);
        }
      }
    },
    [onClaim],
  );

  const processFile = useCallback(
    (selectedFile: File) => {
      setError(null);
      const validation = validatePDF(selectedFile);
      if (!validation.valid) {
        const msg = validation.error!;
        setError(msg);
        setUploadState("error");
        toast.error(msg);
        return;
      }
      setFile(selectedFile);
      void doUpload(selectedFile);
    },
    [doUpload],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        processFile(droppedFile);
      }
    },
    [processFile],
  );

  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        processFile(selectedFile);
      }
    },
    [processFile],
  );

  const handleDragEnter = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return {
    file,
    uploadProgress,
    uploadState,
    error,
    isDragging,
    uploadedKey,
    setUploadedKey,
    setUploadProgress,
    setUploadState,
    setError,
    setFile,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    processFile,
  };
}
