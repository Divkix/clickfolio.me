"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatRelativeTime } from "@/lib/utils/format";
export type SaveStatus = "idle" | "saving" | "saved" | "error" | "unsaved";

interface SaveIndicatorProps {
  status: SaveStatus;
  lastSaved?: Date | null;
  className?: string;
}

export function SaveIndicator({ status, lastSaved, className }: SaveIndicatorProps) {
  if (status === "idle") return null;

  return (
    <output className={cn("flex items-center gap-2 text-sm", className)} aria-live="polite">
      {status === "saving" && (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Saving...</span>
        </>
      )}
      {status === "saved" &&
        lastSaved &&
        (() => {
          const time = formatRelativeTime(lastSaved);
          const display = time === "Just now" ? "just now" : time;
          return (
            <>
              <Check className="h-4 w-4 text-success" />
              <span className="text-muted-foreground">Saved {display}</span>
            </>
          );
        })()}
      {status === "error" && (
        <>
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-destructive">Save failed</span>
        </>
      )}
      {status === "unsaved" && (
        <>
          <AlertCircle className="h-4 w-4 text-warning" />
          <span className="text-warning">Unsaved changes</span>
        </>
      )}
    </output>
  );
}
