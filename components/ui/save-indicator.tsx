"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "unsaved";

interface SaveIndicatorProps {
  status: SaveStatus;
  lastSaved?: Date | null;
  className?: string;
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SaveIndicator({ status, lastSaved, className }: SaveIndicatorProps) {
  if (status === "idle") return null;

  return (
    <div
      className={cn("flex items-center gap-2 text-sm", className)}
      role="status"
      aria-live="polite"
    >
      {status === "saving" && (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Saving...</span>
        </>
      )}
      {status === "saved" && lastSaved && (
        <>
          <Check className="h-4 w-4 text-emerald-600" />
          <span className="text-muted-foreground">Saved {formatRelativeTime(lastSaved)}</span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="h-4 w-4 text-coral" />
          <span className="text-coral">Save failed</span>
        </>
      )}
      {status === "unsaved" && (
        <>
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <span className="text-amber-500">Unsaved changes</span>
        </>
      )}
    </div>
  );
}
