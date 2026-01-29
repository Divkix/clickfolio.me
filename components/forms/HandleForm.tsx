"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Copy, Link2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { siteConfig } from "@/lib/config/site";
import { type HandleUpdate, handleUpdateSchema } from "@/lib/schemas/profile";
import { copyToClipboard } from "@/lib/utils/clipboard";

interface HandleFormProps {
  currentHandle: string;
}

interface ErrorResponse {
  error?: string;
  message?: string;
}

export function HandleForm({ currentHandle }: HandleFormProps) {
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
    // Don't submit if handle hasn't changed
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

      // Refresh the page to update the UI with new handle
      router.refresh();
    } catch (err) {
      console.error("Handle update error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update handle");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Public Handle
        </CardTitle>
        <CardDescription>Your unique URL for sharing your resume</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Current Handle Display */}
          <div className="space-y-2">
            <Label htmlFor="current-url" className="text-sm text-gray-600">
              Current Public URL
            </Label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-gray-50 font-mono text-sm">
                <Link2 className="h-4 w-4 text-gray-400" />
                <span className="text-gray-900">{siteConfig.domain}/@</span>
                <span className="font-semibold text-blue-600">{currentHandle}</span>
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
                <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2">
                  <span className="text-sm text-gray-500">{siteConfig.domain}/@</span>
                  <Input
                    id="handle"
                    {...register("handle")}
                    placeholder="your-handle"
                    className="border-0 p-0 h-auto focus-visible:ring-0 font-mono text-sm"
                    disabled={isSaving}
                  />
                </div>
                {errors.handle && <p className="text-sm text-red-600">{errors.handle.message}</p>}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              3-30 characters. Lowercase letters, numbers, and hyphens only.
            </p>
          </div>

          {/* URL Preview */}
          {isDirty && newHandle !== currentHandle && !errors.handle && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-xs font-medium text-blue-900 mb-1">New URL Preview:</p>
              <p className="font-mono text-sm text-blue-700">https://{publicUrl}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={isSaving || !isDirty || !!errors.handle}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Handle...
                </>
              ) : (
                "Update Handle"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
