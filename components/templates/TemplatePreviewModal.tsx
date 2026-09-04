"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect } from "react";
import {
  DEMO_PROFILES,
  DEMO_RESUME_CONTENT,
  TEMPLATE_BACKGROUNDS,
} from "@/lib/templates/demo-data";
import { THEME_METADATA } from "@/lib/templates/theme-ids";
import { DYNAMIC_TEMPLATES } from "@/lib/templates/theme-registry.client";
import { cn } from "@/lib/utils/cn";

interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIndex: number;
  onNavigate: (index: number) => void;
}

export function TemplatePreviewModal({
  isOpen,
  onClose,
  selectedIndex,
  onNavigate,
}: TemplatePreviewModalProps) {
  const currentProfile = DEMO_PROFILES[selectedIndex];
  const themeId = currentProfile?.id;
  const templateConfig = themeId ? TEMPLATE_BACKGROUNDS[themeId] : null;
  const isDark = templateConfig?.isDark ?? false;

  const handlePrev = useCallback(() => {
    const newIndex = selectedIndex === 0 ? DEMO_PROFILES.length - 1 : selectedIndex - 1;
    onNavigate(newIndex);
  }, [selectedIndex, onNavigate]);

  const handleNext = useCallback(() => {
    const newIndex = selectedIndex === DEMO_PROFILES.length - 1 ? 0 : selectedIndex + 1;
    onNavigate(newIndex);
  }, [selectedIndex, onNavigate]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handlePrev, handleNext]);

  if (!currentProfile || !themeId) return null;

  const Template = DYNAMIC_TEMPLATES[themeId];
  const content = DEMO_RESUME_CONTENT[themeId];
  const metadata = THEME_METADATA[themeId];
  const profile = {
    avatar_url: null,
    handle: currentProfile.name.toLowerCase().replace(/\s+/g, ""),
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />

        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-50 flex flex-col max-h-[100dvh] h-[100dvh]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-200",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {metadata.name} template preview
          </DialogPrimitive.Title>

          <div
            className={cn(
              "flex items-center justify-between px-4 py-3 border-b",
              isDark
                ? "bg-slate-900/95 border-slate-700 text-white"
                : "bg-white/95 border-slate-200 text-slate-900",
              "backdrop-blur-sm",
            )}
          >
            <button
              type="button"
              onClick={handlePrev}
              className={cn(
                "flex items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                isDark
                  ? "hover:bg-slate-800 text-slate-300 hover:text-white"
                  : "hover:bg-slate-100 text-slate-600 hover:text-slate-900",
              )}
              aria-label="Previous template"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline text-sm font-medium">Prev</span>
            </button>

            <div className="text-center">
              <h2 className="text-sm font-semibold">{metadata.name}</h2>
              <DialogPrimitive.Description className="sr-only">
                Preview of the {metadata.name} resume template
              </DialogPrimitive.Description>
              <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                {selectedIndex + 1} of {DEMO_PROFILES.length}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleNext}
                className={cn(
                  "flex items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                  isDark
                    ? "hover:bg-slate-800 text-slate-300 hover:text-white"
                    : "hover:bg-slate-100 text-slate-600 hover:text-slate-900",
                )}
                aria-label="Next template"
              >
                <span className="hidden sm:inline text-sm font-medium">Next</span>
                <ChevronRight className="w-5 h-5" />
              </button>

              <DialogPrimitive.Close
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  isDark
                    ? "hover:bg-slate-800 text-slate-300 hover:text-white"
                    : "hover:bg-slate-100 text-slate-600 hover:text-slate-900",
                )}
                aria-label="Close preview"
              >
                <X className="w-5 h-5" />
              </DialogPrimitive.Close>
            </div>
          </div>

          <div
            className={cn(
              "flex-1 overflow-y-auto relative transform-gpu overscroll-contain",
              templateConfig?.bg ?? "bg-white",
            )}
          >
            <Template content={content} profile={profile} isPreview />
          </div>

          <div
            className={cn(
              "flex items-center justify-center px-4 py-2 border-t text-xs",
              isDark
                ? "bg-slate-900/95 border-slate-700 text-slate-400"
                : "bg-white/95 border-slate-200 text-slate-500",
              "backdrop-blur-sm",
            )}
          >
            <span className="hidden sm:inline">
              Use{" "}
              <kbd
                className={cn(
                  "px-1.5 py-0.5 rounded font-mono text-[10px]",
                  isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600",
                )}
              >
                ←
              </kbd>{" "}
              <kbd
                className={cn(
                  "px-1.5 py-0.5 rounded font-mono text-[10px]",
                  isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600",
                )}
              >
                →
              </kbd>{" "}
              to navigate,{" "}
              <kbd
                className={cn(
                  "px-1.5 py-0.5 rounded font-mono text-[10px]",
                  isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600",
                )}
              >
                Esc
              </kbd>{" "}
              to close
            </span>
            <span className="sm:hidden">Swipe or tap arrows to navigate</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
