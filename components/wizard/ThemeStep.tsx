"use client";

import { CheckCircle2, Palette } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { THEME_METADATA, type ThemeId } from "@/lib/templates/theme-ids";
import { cn } from "@/lib/utils/cn";

interface ThemeStepProps {
  initialTheme?: ThemeId;
  /** May be async — the continue handler awaits it to keep the button disabled until the request settles */
  onContinue: (themeId: ThemeId) => void | Promise<void>;
}

/**
 * Step 4: Theme Selection Component
 * Allows users to choose their resume template design
 */
export function ThemeStep({ initialTheme = "minimalist_editorial", onContinue }: ThemeStepProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(initialTheme);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    // Prevent re-entrancy while the completion request is in flight.
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onContinue(selectedTheme);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-brand-subtle rounded-xl flex items-center justify-center mb-6">
          <Palette className="w-8 h-8 text-brand" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 leading-tight">
          Choose Your Template
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Select a design that best represents your professional style. You can change this anytime.
        </p>
      </div>

      {/* Theme Grid */}
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(THEME_METADATA).map(([id, meta]) => {
            // SAFETY: isValidThemeId guard above guarantees id is ThemeId; Object.entries keys are ThemeIds from THEME_METADATA.
            const themeId = id as ThemeId;

            return (
              <Card
                key={id}
                onClick={() => setSelectedTheme(themeId)}
                className={cn(
                  "group relative overflow-hidden transition-colors p-6 shadow-sm",
                  selectedTheme === id
                    ? "ring-2 ring-brand border-brand bg-brand-subtle cursor-pointer"
                    : "border-border hover:border-border-strong bg-card cursor-pointer",
                )}
              >
                {/* Selected Indicator */}
                {selectedTheme === id && (
                  <div className="absolute top-4 right-4">
                    <div className="flex items-center gap-1 bg-brand text-brand-foreground px-3 py-1 rounded-full text-xs font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      Selected
                    </div>
                  </div>
                )}

                {/* Theme Content */}
                <div className="space-y-3">
                  {/* Category Badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-block text-xs font-medium px-2 py-1 rounded-full",
                        selectedTheme === id
                          ? "bg-brand text-brand-foreground"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {meta.category}
                    </span>
                  </div>

                  {/* Theme Name */}
                  <h3
                    className={cn(
                      "text-xl font-bold transition-colors",
                      selectedTheme === id ? "text-brand" : "text-foreground",
                    )}
                  >
                    {meta.name}
                  </h3>

                  {/* Description */}
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {meta.description}
                  </p>

                  {/* Visual Indicator / Preview */}
                  <div className="pt-2">
                    <div
                      className={cn(
                        "aspect-16/10 rounded-lg overflow-hidden border transition-colors relative",
                        selectedTheme === id ? "border-brand" : "border-border",
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
            );
          })}
        </div>

        {/* Selected Theme Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Currently selected:{" "}
            <span className="font-bold text-brand">{THEME_METADATA[selectedTheme].name}</span>
          </p>
        </div>

        {/* Continue Button */}
        <div className="pt-6">
          <Button
            onClick={handleContinue}
            disabled={isSubmitting}
            loading={isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? "Completing..." : "Complete Setup"}
          </Button>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground font-medium">
          You can change your template anytime in dashboard settings.
        </p>
      </div>
    </div>
  );
}
