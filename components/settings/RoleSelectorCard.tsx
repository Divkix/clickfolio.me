"use client";

import { Loader2, Sparkles, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ROLE_OPTIONS } from "@/lib/schemas/profile";

interface RoleSelectorCardProps {
  currentRole: string | null;
  roleSource: string | null;
}

export function RoleSelectorCard({ currentRole, roleSource }: RoleSelectorCardProps) {
  const [role, setRole] = useState(currentRole || "");
  const [source, setSource] = useState(roleSource);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (newRole: string) => {
    if (!newRole || newRole === role) return;

    const previousRole = role;
    const previousSource = source;

    // Optimistic update
    setRole(newRole);
    setSource("user");
    setIsSaving(true);

    try {
      const response = await fetch("/api/profile/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        throw new Error("Failed to update role");
      }

      toast.success("Professional level updated");
    } catch {
      // Rollback on error
      setRole(previousRole);
      setSource(previousSource);
      toast.error("Failed to update professional level");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-brand" />
          <h3 className="text-lg font-semibold text-foreground">Professional Level</h3>
        </div>
        {isSaving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Saving...</span>
          </div>
        )}
      </div>

      <select
        value={role}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isSaving}
        className="w-full px-3 py-2 border border-border-strong rounded-lg text-sm bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-brand disabled:opacity-50"
      >
        <option value="">Select your professional level</option>
        {ROLE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {source && (
        <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
          {source === "ai" ? (
            <>
              <Sparkles className="h-3 w-3 text-brand" />
              Detected by AI — you can change it anytime
            </>
          ) : (
            <>Manually set by you</>
          )}
        </p>
      )}
    </div>
  );
}
