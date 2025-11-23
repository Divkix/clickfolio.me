"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { THEME_METADATA, type ThemeId } from "@/lib/templates/theme-registry";
import { Palette, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeStepProps {
  initialTheme?: ThemeId;
  onContinue: (themeId: ThemeId) => void;
}

/**
 * Step 4: Theme Selection Component
 * Allows users to choose their resume template design
 */
export function ThemeStep({
  initialTheme = "minimalist_editorial",
  onContinue,
}: ThemeStepProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(initialTheme);

  const handleContinue = () => {
    onContinue(selectedTheme);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-linear-to-r from-indigo-100 to-blue-100 rounded-2xl flex items-center justify-center mb-6">
          <Palette className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 leading-tight">
          Choose Your Template
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Select a design that best represents your professional style. You can
          change this anytime.
        </p>
      </div>

      {/* Theme Grid */}
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(THEME_METADATA).map(([id, meta]) => (
            <Card
              key={id}
              onClick={() => setSelectedTheme(id as ThemeId)}
              className={cn(
                "group relative cursor-pointer overflow-hidden transition-all duration-300 p-6",
                "border-2 shadow-depth-sm hover:shadow-depth-lg hover:-translate-y-1",
                selectedTheme === id
                  ? "border-indigo-600 ring-2 ring-indigo-100 bg-indigo-50/50"
                  : "border-slate-200/60 hover:border-indigo-300 bg-white",
              )}
            >
              {/* Selected Indicator */}
              {selectedTheme === id && (
                <div className="absolute top-4 right-4">
                  <div className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    Selected
                  </div>
                </div>
              )}

              {/* Theme Content */}
              <div className="space-y-3">
                {/* Category Badge */}
                <div>
                  <span
                    className={cn(
                      "inline-block text-xs uppercase tracking-wide font-bold px-2 py-1 rounded",
                      selectedTheme === id
                        ? "bg-indigo-200 text-indigo-900"
                        : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {meta.category}
                  </span>
                </div>

                {/* Theme Name */}
                <h3
                  className={cn(
                    "text-xl font-bold transition-colors",
                    selectedTheme === id
                      ? "text-indigo-900"
                      : "text-slate-900 group-hover:text-indigo-600",
                  )}
                >
                  {meta.name}
                </h3>

                {/* Description */}
                <p
                  className={cn(
                    "text-sm leading-relaxed",
                    selectedTheme === id ? "text-slate-700" : "text-slate-600",
                  )}
                >
                  {meta.description}
                </p>

                {/* Visual Indicator */}
                <div className="pt-2">
                  <div
                    className={cn(
                      "h-20 rounded-lg border-2 transition-all",
                      getThemePreviewStyle(id as ThemeId),
                      selectedTheme === id
                        ? "border-indigo-400"
                        : "border-slate-200",
                    )}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Selected Theme Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            Currently selected:{" "}
            <span className="font-bold text-indigo-600">
              {THEME_METADATA[selectedTheme].name}
            </span>
          </p>
        </div>

        {/* Continue Button */}
        <div className="pt-6">
          <Button
            onClick={handleContinue}
            className="w-full bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold shadow-depth-sm hover:shadow-depth-md transition-all duration-300"
            size="lg"
          >
            Complete Setup
          </Button>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-center">
        <p className="text-sm text-slate-500 font-medium">
          You can change your template anytime in dashboard settings.
        </p>
      </div>
    </div>
  );
}

/**
 * Get preview style classes for each theme
 */
function getThemePreviewStyle(themeId: ThemeId): string {
  switch (themeId) {
    case "bento":
      return "bg-linear-to-br from-purple-100 via-pink-50 to-orange-100";
    case "glass":
      return "bg-linear-to-br from-slate-900 via-slate-800 to-indigo-900";
    case "minimalist_editorial":
      return "bg-linear-to-br from-slate-50 via-white to-slate-100";
    case "neo_brutalist":
      return "bg-linear-to-br from-yellow-300 via-white to-black";
    default:
      return "bg-slate-100";
  }
}
