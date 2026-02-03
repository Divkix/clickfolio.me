"use client";

import { CheckCircle2, Palette } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { THEME_METADATA, type ThemeId } from "@/lib/templates/theme-ids";
import { cn } from "@/lib/utils";

interface ThemeStepProps {
  initialTheme?: ThemeId;
  onContinue: (themeId: ThemeId) => void;
}

/**
 * Step 4: Theme Selection Component
 * Allows users to choose their resume template design
 */
export function ThemeStep({ initialTheme = "minimalist_editorial", onContinue }: ThemeStepProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(initialTheme);

  const handleContinue = () => {
    onContinue(selectedTheme);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-linear-to-r from-coral/20 to-coral/20 rounded-2xl flex items-center justify-center mb-6">
          <Palette className="w-8 h-8 text-coral" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 leading-tight">
          Choose Your Template
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Select a design that best represents your professional style. You can change this anytime.
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
                  ? "border-coral ring-2 ring-coral/20 bg-coral/10"
                  : "border-slate-200/60 hover:border-coral/40 bg-white",
              )}
            >
              {/* Selected Indicator */}
              {selectedTheme === id && (
                <div className="absolute top-4 right-4">
                  <div className="flex items-center gap-1 bg-coral text-white px-3 py-1 rounded-full text-xs font-bold">
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
                        ? "bg-coral/30 text-coral"
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
                    selectedTheme === id ? "text-coral" : "text-slate-900 group-hover:text-coral",
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
                      "aspect-16/10 rounded-lg overflow-hidden border-2 transition-all",
                      selectedTheme === id ? "border-coral" : "border-slate-200",
                    )}
                  >
                    <img
                      src={meta.preview}
                      alt={`${meta.name} preview`}
                      className="w-full h-full object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Selected Theme Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            Currently selected:{" "}
            <span className="font-bold text-coral">{THEME_METADATA[selectedTheme].name}</span>
          </p>
        </div>

        {/* Continue Button */}
        <div className="pt-6">
          <Button
            onClick={handleContinue}
            className="w-full bg-linear-to-r from-coral to-coral hover:from-coral/90 hover:to-coral/90 text-white font-semibold shadow-depth-sm hover:shadow-depth-md transition-all duration-300"
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
