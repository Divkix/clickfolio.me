"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { siteConfig } from "@/lib/config/site";
import { type PrivacySettings, privacySettingsSchema } from "@/lib/schemas/profile";

interface PrivacySettingsFormProps {
  initialSettings: PrivacySettings;
  userHandle: string | null;
}

export function PrivacySettingsForm({ initialSettings, userHandle }: PrivacySettingsFormProps) {
  const [isSaving, setIsSaving] = useState(false);

  const { watch, setValue } = useForm<PrivacySettings>({
    resolver: zodResolver(privacySettingsSchema),
    defaultValues: initialSettings,
  });

  const showPhone = watch("show_phone");
  const showAddress = watch("show_address");

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
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update privacy settings");
      }

      toast.success("Privacy settings updated successfully");
    } catch (err) {
      console.error("Privacy update error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update privacy settings");
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save on toggle change
  const handleToggleChange = async (field: keyof PrivacySettings, value: boolean) => {
    setValue(field, value, { shouldValidate: true });

    // Trigger save with new value
    const newSettings = {
      show_phone: field === "show_phone" ? value : showPhone,
      show_address: field === "show_address" ? value : showAddress,
    };

    await onSubmit(newSettings);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Privacy Settings
        </CardTitle>
        <CardDescription>
          Control what information is visible on your public resume page
          {userHandle && (
            <span className="block mt-1 text-xs">
              Preview at:{" "}
              <span className="font-mono">
                {siteConfig.domain}/{userHandle}
              </span>
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Phone Number Toggle */}
        <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4">
          <div className="flex-1 space-y-1">
            <Label htmlFor="show_phone" className="text-base font-medium cursor-pointer">
              Show phone number
            </Label>
            <p className="text-sm text-gray-500">
              {showPhone
                ? "Your phone number will be visible on your public resume"
                : "Your phone number will be hidden from your public resume"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
            <Switch
              id="show_phone"
              checked={showPhone}
              onCheckedChange={(checked) => handleToggleChange("show_phone", checked)}
              disabled={isSaving}
              aria-label="Toggle phone number visibility"
            />
          </div>
        </div>

        {/* Address Toggle */}
        <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4">
          <div className="flex-1 space-y-1">
            <Label htmlFor="show_address" className="text-base font-medium cursor-pointer">
              Show full address
            </Label>
            <p className="text-sm text-gray-500">
              {showAddress
                ? "Your full street address will be shown on your public resume"
                : "Only your city and state will be shown (street address hidden)"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
            <Switch
              id="show_address"
              checked={showAddress}
              onCheckedChange={(checked) => handleToggleChange("show_address", checked)}
              disabled={isSaving}
              aria-label="Toggle address visibility"
            />
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className="flex gap-3">
            <EyeOff className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Privacy by Default</p>
              <p className="text-blue-700">
                Your email is always visible (using secure mailto: links). We hide sensitive contact
                information by default to protect your privacy.
              </p>
            </div>
          </div>
        </div>

        {/* Current Status Summary */}
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-700 mb-2">Current Privacy Status:</p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-700">
              Email: <span className="font-medium">Always visible</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
                showPhone ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
              }`}
            >
              Phone: <span className="font-medium">{showPhone ? "Visible" : "Hidden"}</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
                showAddress ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
              }`}
            >
              Address:{" "}
              <span className="font-medium">{showAddress ? "Full" : "City/State only"}</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
