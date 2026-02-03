"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Copy, Link2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { siteConfig } from "@/lib/config/site";
import { type HandleUpdate, handleUpdateSchema } from "@/lib/schemas/profile";
import { copyToClipboard } from "@/lib/utils/clipboard";

interface HandleFormProps {
  currentHandle: string;
  variant?: "default" | "compact";
}

interface ErrorResponse {
  error?: string;
  message?: string;
}

export function HandleForm({ currentHandle, variant = "default" }: HandleFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<HandleUpdate>({
    resolver: zodResolver(handleUpdateSchema),
    defaultValues: {
      handle: currentHandle,
    },
  });

  const newHandle = watch("handle");
  const publicUrl = `${siteConfig.domain}/@${newHandle || currentHandle}`;

  const handleCopy = async () => {
    const success = await copyToClipboard(`https://${publicUrl}`);

    if (success) {
      setCopied(true);
      toast.success("URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Failed to copy URL");
    }
  };

  const onSubmit = async (data: HandleUpdate) => {
    if (data.handle === currentHandle) {
      toast.info("Handle is already set to this value");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/profile/handle", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ErrorResponse;
        throw new Error(errorData.message || "Failed to update handle");
      }

      await response.json();

      toast.success("Handle updated successfully!");
      router.refresh();
    } catch (err) {
      console.error("Handle update error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update handle");
    } finally {
      setIsSaving(false);
    }
  };

  if (variant === "compact") {
    return (
      <div className="space-y-4">
        {/* Current URL with copy button */}
        <div>
          <Label className="text-xs text-slate-500 mb-1.5 block">Public URL</Label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-mono text-sm min-w-0">
              <Link2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-600 truncate">{siteConfig.domain}/@</span>
              <span className="font-semibold text-coral truncate">{currentHandle}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className="shrink-0 h-[38px] w-[38px]"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Inline change handle form */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <Label htmlFor="handle-compact" className="text-xs text-slate-500 mb-1.5 block">
            Change Handle
          </Label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 min-w-0">
              <span className="text-sm text-slate-400 shrink-0">@</span>
              <Input
                id="handle-compact"
                {...register("handle")}
                placeholder="new-handle"
                className="border-0 p-0 h-9 focus-visible:ring-0 font-mono text-sm"
                disabled={isSaving}
              />
            </div>
            <Button
              type="submit"
              disabled={isSaving || !isDirty || !!errors.handle}
              className="shrink-0"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
            </Button>
          </div>
          {errors.handle && <p className="text-xs text-coral mt-1">{errors.handle.message}</p>}
          {isDirty && newHandle !== currentHandle && !errors.handle && (
            <p className="text-xs text-coral mt-1">
              Preview: {siteConfig.domain}/@{newHandle}
            </p>
          )}
        </form>
      </div>
    );
  }

  // Default full card variant (keeping original for backwards compatibility)
  return (
    <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Link2 className="h-5 w-5 text-coral" />
        <h3 className="text-lg font-semibold text-slate-900">Public Handle</h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Current URL Display */}
        <div className="space-y-2">
          <Label htmlFor="current-url" className="text-sm text-slate-600">
            Current Public URL
          </Label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-slate-50 font-mono text-sm">
              <Link2 className="h-4 w-4 text-slate-400" />
              <span className="text-slate-600">{siteConfig.domain}/@</span>
              <span className="font-semibold text-coral">{currentHandle}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* New Handle Input */}
        <div className="space-y-2">
          <Label htmlFor="handle">Change Handle</Label>
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                <span className="text-sm text-slate-500">{siteConfig.domain}/@</span>
                <Input
                  id="handle"
                  {...register("handle")}
                  placeholder="your-handle"
                  className="border-0 p-0 h-auto focus-visible:ring-0 font-mono text-sm"
                  disabled={isSaving}
                />
              </div>
              {errors.handle && <p className="text-sm text-coral">{errors.handle.message}</p>}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            3-30 characters. Lowercase letters, numbers, and hyphens only.
          </p>
        </div>

        {/* URL Preview */}
        {isDirty && newHandle !== currentHandle && !errors.handle && (
          <div className="rounded-lg bg-coral/10 border border-coral/30 p-3">
            <p className="text-xs font-medium text-coral mb-1">New URL Preview:</p>
            <p className="font-mono text-sm text-coral">https://{publicUrl}</p>
          </div>
        )}

        {/* Submit Button */}
        <Button type="submit" disabled={isSaving || !isDirty || !!errors.handle} className="w-full">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating Handle...
            </>
          ) : (
            "Update Handle"
          )}
        </Button>
      </form>
    </div>
  );
}
