"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { LucideIcon } from "lucide-react";
import { Eye, Globe, Loader2, MapPin, Phone, Search, SearchX, Users } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import type { PrivacySettings } from "@/lib/db/schema/auth";
import { privacySettingsSchema } from "@/lib/schemas/profile";
import type { ApiErrorBody } from "@/lib/types/api";

interface PrivacySettingsFormProps {
  initialSettings: PrivacySettings;
  // Version of the user row the page loaded; sent as If-Unmodified-Since so a stale save is rejected.
  initialUpdatedAt?: string;
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

type StatusTone = "success" | "warning" | "neutral";

const CHIP_CLASS = {
  success: "inline-flex items-center gap-1 px-2 py-1 rounded-md bg-success/10 text-success",
  warning: "inline-flex items-center gap-1 px-2 py-1 rounded-md bg-warning/10 text-warning",
  neutral:
    "inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-secondary-foreground",
} satisfies Record<StatusTone, string>;

interface PrivacyToggleState {
  icon: LucideIcon;
  description: string;
  chipText: string;
  tone: StatusTone;
}

interface PrivacyToggle {
  field: keyof PrivacySettings;
  label: string;
  variant?: "warning";
  state: (on: boolean) => PrivacyToggleState;
}

const PRIVACY_TOGGLES: PrivacyToggle[] = [
  {
    field: "show_phone",
    label: "Phone",
    state: (on) => ({
      icon: Phone,
      description: on ? "Visible" : "Hidden",
      chipText: on ? "Visible" : "Hidden",
      tone: on ? "success" : "neutral",
    }),
  },
  {
    field: "show_address",
    label: "Address",
    state: (on) => ({
      icon: MapPin,
      description: on ? "Full address" : "City only",
      chipText: on ? "Full" : "City only",
      tone: on ? "success" : "neutral",
    }),
  },
  {
    field: "hide_from_search",
    label: "Search",
    variant: "warning",
    state: (on) => ({
      icon: on ? SearchX : Search,
      description: on ? "Hidden" : "Indexed",
      chipText: on ? "Hidden" : "Indexed",
      tone: on ? "warning" : "success",
    }),
  },
  {
    field: "show_in_directory",
    label: "Directory",
    state: (on) => ({
      icon: on ? Users : Globe,
      description: on ? "Listed on /explore" : "Not listed",
      chipText: on ? "Listed" : "Not listed",
      tone: on ? "success" : "neutral",
    }),
  },
];

export function PrivacySettingsForm({
  initialSettings,
  initialUpdatedAt,
}: PrivacySettingsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const updatedAtRef = useRef(initialUpdatedAt);

  const { watch, setValue } = useForm<PrivacySettings>({
    resolver: zodResolver(privacySettingsSchema),
    defaultValues: initialSettings,
  });

  const values: PrivacySettings = {
    show_phone: Boolean(watch("show_phone")),
    show_address: Boolean(watch("show_address")),
    hide_from_search: Boolean(watch("hide_from_search")),
    show_in_directory: Boolean(watch("show_in_directory")),
  };

  const onSubmit = async (data: PrivacySettings): Promise<boolean> => {
    setIsSaving(true);

    try {
      // Chained saves carry the freshly written version; absent ref means first save.
      const response = await fetch("/api/profile/privacy", {
        method: "PUT",
        headers: updatedAtRef.current
          ? { "Content-Type": "application/json", "If-Unmodified-Since": updatedAtRef.current }
          : { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        // SAFETY: fetch response is JSON with known ApiErrorBody shape; cast bridges unknown JSON to typed error body.
        const errorData = (await response.json()) as ApiErrorBody;
        throw new Error(errorData.error || "Failed to update privacy settings");
      }

      // SAFETY: success body is our own route response; updated_at is the freshly written version.
      const successData = (await response.json()) as { updated_at?: string };
      if (successData.updated_at) updatedAtRef.current = successData.updated_at;

      toast.success("Privacy settings updated");
      return true;
    } catch (err) {
      console.error("Privacy update error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update privacy settings");
      return false;
    } finally {
      setIsSaving(false);
      setSavingField(null);
    }
  };

  const handleToggleChange = async (field: keyof PrivacySettings, value: boolean) => {
    setValue(field, value, { shouldValidate: true });
    setSavingField(field);

    const newSettings = { ...values };
    newSettings[field] = value;

    const saved = await onSubmit(newSettings);

    if (!saved) {
      setValue(field, !value, { shouldValidate: true });
    }
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {PRIVACY_TOGGLES.map(({ field, label, variant, state }) => {
          const { icon, description } = state(values[field]);

          return (
            <ToggleCard
              key={field}
              icon={icon}
              label={label}
              description={description}
              checked={values[field]}
              onCheckedChange={(checked) => handleToggleChange(field, checked)}
              disabled={isSaving && savingField === field}
              variant={variant}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-secondary-foreground">
          Email: <span className="font-medium">Always visible</span>
        </span>
        {PRIVACY_TOGGLES.map(({ field, label, state }) => {
          const { chipText, tone } = state(values[field]);

          return (
            <span key={field} className={CHIP_CLASS[tone]}>
              {label}: <span className="font-medium">{chipText}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
