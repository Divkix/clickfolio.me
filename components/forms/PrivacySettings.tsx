"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { LucideIcon } from "lucide-react";
import { Eye, Globe, Loader2, MapPin, Phone, Search, SearchX, Users } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import type { PrivacySettings } from "@/lib/db/schema/auth";
import { privacySettingsSchema } from "@/lib/schemas/profile";

interface PrivacySettingsFormProps {
  initialSettings: PrivacySettings;
}

interface ErrorResponse {
  error?: string;
  message?: string;
}

interface ToggleCardProps {
  icon: LucideIcon;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
  variant?: "default" | "warning";
}

function ToggleCard({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  variant = "default",
}: ToggleCardProps) {
  const isWarning = variant === "warning" && checked;

  return (
    <div
      className={`relative rounded-xl border p-4 transition-colors duration-200 ${
        isWarning
          ? "border-warning/30 bg-warning/10"
          : "border-border bg-surface-2 hover:border-border-strong"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`shrink-0 rounded-lg p-2 ${
              isWarning ? "bg-warning/10 text-warning" : "bg-brand-subtle text-brand"
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{label}</p>
            <p className={`text-xs mt-0.5 ${isWarning ? "text-warning" : "text-muted-foreground"}`}>
              {description}
            </p>
          </div>
        </div>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className="shrink-0"
        />
      </div>
    </div>
  );
}

export function PrivacySettingsForm({ initialSettings }: PrivacySettingsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);

  const { watch, setValue } = useForm<PrivacySettings>({
    resolver: zodResolver(privacySettingsSchema),
    defaultValues: initialSettings,
  });

  const showPhone = watch("show_phone");
  const showAddress = watch("show_address");
  const hideFromSearch = watch("hide_from_search");
  const showInDirectory = watch("show_in_directory");

  const onSubmit = async (data: PrivacySettings) => {
    setIsSaving(true);

    try {
      const response = await fetch("/api/profile/privacy", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ErrorResponse;
        throw new Error(errorData.message || "Failed to update privacy settings");
      }

      toast.success("Privacy settings updated");
    } catch (err) {
      console.error("Privacy update error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update privacy settings");
    } finally {
      setIsSaving(false);
      setSavingField(null);
    }
  };

  const handleToggleChange = async (field: keyof PrivacySettings, value: boolean) => {
    setValue(field, value, { shouldValidate: true });
    setSavingField(field);

    const newSettings = {
      show_phone: field === "show_phone" ? value : showPhone,
      show_address: field === "show_address" ? value : showAddress,
      hide_from_search: field === "hide_from_search" ? value : (hideFromSearch ?? false),
      show_in_directory: field === "show_in_directory" ? value : (showInDirectory ?? false),
    };

    await onSubmit(newSettings);
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-brand" />
          <h3 className="text-lg font-semibold text-foreground">Privacy</h3>
        </div>
        {isSaving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Saving...</span>
          </div>
        )}
      </div>

      {/* Compact toggle grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <ToggleCard
          icon={Phone}
          label="Phone"
          description={showPhone ? "Visible" : "Hidden"}
          checked={showPhone}
          onCheckedChange={(checked) => handleToggleChange("show_phone", checked)}
          disabled={isSaving && savingField === "show_phone"}
        />
        <ToggleCard
          icon={MapPin}
          label="Address"
          description={showAddress ? "Full address" : "City only"}
          checked={showAddress}
          onCheckedChange={(checked) => handleToggleChange("show_address", checked)}
          disabled={isSaving && savingField === "show_address"}
        />
        <ToggleCard
          icon={hideFromSearch ? SearchX : Search}
          label="Search"
          description={hideFromSearch ? "Hidden" : "Indexed"}
          checked={hideFromSearch ?? false}
          onCheckedChange={(checked) => handleToggleChange("hide_from_search", checked)}
          disabled={isSaving && savingField === "hide_from_search"}
          variant="warning"
        />
        <ToggleCard
          icon={showInDirectory ? Users : Globe}
          label="Directory"
          description={showInDirectory ? "Listed on /explore" : "Not listed"}
          checked={showInDirectory ?? false}
          onCheckedChange={(checked) => handleToggleChange("show_in_directory", checked)}
          disabled={isSaving && savingField === "show_in_directory"}
        />
      </div>

      {/* Inline status badges */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-secondary-foreground">
          Email: <span className="font-medium">Always visible</span>
        </span>
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${
            showPhone ? "bg-success/10 text-success" : "bg-secondary text-secondary-foreground"
          }`}
        >
          Phone: <span className="font-medium">{showPhone ? "Visible" : "Hidden"}</span>
        </span>
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${
            showAddress ? "bg-success/10 text-success" : "bg-secondary text-secondary-foreground"
          }`}
        >
          Address: <span className="font-medium">{showAddress ? "Full" : "City only"}</span>
        </span>
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${
            hideFromSearch ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
          }`}
        >
          Search: <span className="font-medium">{hideFromSearch ? "Hidden" : "Indexed"}</span>
        </span>
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${
            showInDirectory
              ? "bg-success/10 text-success"
              : "bg-secondary text-secondary-foreground"
          }`}
        >
          Directory:{" "}
          <span className="font-medium">{showInDirectory ? "Listed" : "Not listed"}</span>
        </span>
      </div>
    </div>
  );
}
