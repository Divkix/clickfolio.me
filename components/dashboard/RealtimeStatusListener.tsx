"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface RealtimeStatusListenerProps {
  resumeId: string;
  userId: string;
  currentStatus: string;
}

type DetectedState = {
  status: "processing" | "completed" | "failed";
  errorMessage?: string;
};

export function RealtimeStatusListener({
  resumeId,
  userId,
  currentStatus,
}: RealtimeStatusListenerProps) {
  // Memoize supabase client to prevent recreation on every render
  const supabase = useMemo(() => createClient(), []);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasRefreshedRef = useRef(false);
  const [detected, setDetected] = useState<DetectedState>({
    status: "processing",
  });

  const handleStatusChange = useCallback(
    (newStatus: string, errorMessage?: string) => {
      if (hasRefreshedRef.current) return;
      if (newStatus === "completed" || newStatus === "failed") {
        hasRefreshedRef.current = true;

        setDetected({
          status: newStatus as "completed" | "failed",
          errorMessage,
        });

        setTimeout(() => {
          window.location.reload();
        }, 800);
      }
    },
    [],
  );

  useEffect(() => {
    // Set up Realtime subscription
    const channel = supabase
      .channel(`resume-status-${resumeId}`)
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
          const errorMessage = payload.new?.error_message as string | undefined;
          if (newStatus) {
            handleStatusChange(newStatus, errorMessage);
          }
        },
      )
      .subscribe();

    // Polling fallback
    const pollStatus = async () => {
      if (hasRefreshedRef.current) return;
      try {
        const { data } = await supabase
          .from("resumes")
          .select("status, error_message")
          .eq("id", resumeId)
          .single();

        if (data?.status && data.status !== currentStatus) {
          handleStatusChange(data.status, data.error_message ?? undefined);
        }
      } catch {
        // Ignore polling errors
      }
    };

    // Poll immediately, then every 3 seconds
    pollStatus();
    pollIntervalRef.current = setInterval(pollStatus, 3000);

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [resumeId, userId, currentStatus, handleStatusChange, supabase]);

  if (detected.status === "completed") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 mb-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-green-900">
              Processing Complete!
            </h3>
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
              {detected.errorMessage ||
                "An error occurred while processing your resume."}
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
          <h3 className="font-semibold text-blue-900">
            Processing Your Resume
          </h3>
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
