"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Copy, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { siteConfig } from "@/lib/config/site";
import { type HandleUpdate, handleUpdateSchema } from "@/lib/schemas/profile";
import type { ApiErrorBody } from "@/lib/types/api";

interface HandleFormProps {
  currentHandle: string;
}

export function HandleForm({ currentHandle }: HandleFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { copied, copy } = useCopyToClipboard();
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
    await copy(`https://${publicUrl}`, {
      successMessage: "URL copied to clipboard",
      errorMessage: "Failed to copy URL",
    });
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
        // SAFETY: ApiErrorBody is from our /api/profile/handle endpoint; shape is server-controlled error response.
        const errorData = (await response.json()) as ApiErrorBody;
        throw new Error(errorData.error || "Failed to update handle");
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

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Public URL</Label>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-strong bg-surface-2 font-mono text-sm min-w-0">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground truncate">{siteConfig.domain}/@</span>
            <span className="font-semibold text-brand truncate">{currentHandle}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={copied ? "Public URL copied" : "Copy public URL"}
            onClick={handleCopy}
            className="shrink-0 h-[38px] w-[38px]"
          >
            {copied ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Label htmlFor="handle" className="text-xs text-muted-foreground mb-1.5 block">
          Change Handle
        </Label>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-1.5 rounded-lg border border-border-strong bg-card px-3 min-w-0">
            <span className="text-sm text-muted-foreground shrink-0">@</span>
            <Input
              id="handle"
              {...register("handle")}
              placeholder="new-handle"
              className="border-0 p-0 h-9 focus-visible:ring-0 font-mono text-sm"
              disabled={isSaving}
            />
          </div>
          <Button
            type="submit"
            loading={isSaving}
            disabled={!isDirty || !!errors.handle}
            className="shrink-0"
          >
            Update
          </Button>
        </div>
        {errors.handle && <p className="text-xs text-destructive mt-1">{errors.handle.message}</p>}
        {isDirty && newHandle !== currentHandle && !errors.handle && (
          <p className="text-xs text-brand mt-1">
            Preview: {siteConfig.domain}/@{newHandle}
          </p>
        )}
      </form>
    </div>
  );
}
