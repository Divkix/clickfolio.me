"use client";

import { CheckCircle2, Eye, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TemplatePreviewModal } from "@/components/templates/TemplatePreviewModal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_PROFILES } from "@/lib/templates/demo-data";
import { THEME_METADATA, type ThemeId } from "@/lib/templates/theme-registry";
import { cn } from "@/lib/utils";

interface ThemeSelectorProps {
  initialThemeId: string;
}

interface ErrorResponse {
  error?: string;
}

function getProfileIndex(themeId: ThemeId): number {
  const index = DEMO_PROFILES.findIndex((p) => p.id === themeId);
  return index >= 0 ? index : 0;
}

export function ThemeSelector({ initialThemeId }: ThemeSelectorProps) {
  const router = useRouter();
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(
    (initialThemeId as ThemeId) || "minimalist_editorial",
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  async function handleThemeChange(themeId: ThemeId) {
    if (themeId === selectedTheme) return;

    setIsUpdating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/resume/update-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme_id: themeId }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ErrorResponse;
        throw new Error(errorData.error || "Failed to update theme");
      }

      setSelectedTheme(themeId);
      setSuccessMessage(`Theme updated to ${THEME_METADATA[themeId].name}`);

      // Refresh the page to reflect changes
      router.refresh();

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      console.error("Failed to update theme:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to update theme");
    } finally {
      setIsUpdating(false);
    }
  }

  function handlePreviewClick(e: React.MouseEvent, themeId: ThemeId) {
    e.stopPropagation();
    setPreviewIndex(getProfileIndex(themeId));
    setPreviewOpen(true);
  }

  return (
    <>
      <Card className="shadow-depth-sm border-slate-200/60 hover:shadow-depth-md transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-slate-900">Choose Your Template</CardTitle>
          <CardDescription className="text-slate-600">
            Select how your resume appears to visitors
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Success/Error Messages */}
          {successMessage && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 text-sm">
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Theme Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(THEME_METADATA).map(([id, meta]) => (
              <button
                type="button"
                key={id}
                onClick={() => handleThemeChange(id as ThemeId)}
                disabled={isUpdating}
                className={cn(
                  "relative cursor-pointer rounded-xl overflow-hidden transition-all duration-300",
                  "border-2 shadow-depth-sm hover:shadow-depth-md hover:-translate-y-0.5",
                  "p-4 text-left bg-white",
                  selectedTheme === id
                    ? "border-indigo-600 ring-2 ring-indigo-100"
                    : "border-slate-200/60 hover:border-slate-300",
                  isUpdating && "opacity-50 cursor-not-allowed hover:translate-y-0",
                )}
              >
                {/* Thumbnail Preview */}
                <div className="aspect-16/10 bg-slate-100 rounded-lg mb-3 overflow-hidden">
                  <img
                    src={meta.preview}
                    alt={`${meta.name} preview`}
                    className="w-full h-full object-cover object-top"
                    loading="lazy"
                  />
                </div>

                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">{meta.name}</h3>
                    <span className="text-xs uppercase tracking-wide text-slate-500 font-medium">
                      {meta.category}
                    </span>
                  </div>
                  {selectedTheme === id && (
                    <div className="flex items-center gap-1">
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                      ) : (
                        <span className="text-indigo-600 text-sm font-bold">Active</span>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-sm text-slate-600 mb-2">{meta.description}</p>

                {/* Preview Link */}
                <button
                  type="button"
                  onClick={(e) => handlePreviewClick(e, id as ThemeId)}
                  className="inline-flex items-center text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Full Preview
                </button>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <TemplatePreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        selectedIndex={previewIndex}
        onNavigate={setPreviewIndex}
      />
    </>
  );
}
