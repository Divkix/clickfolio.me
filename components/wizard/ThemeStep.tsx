"use client";

import { CheckCircle2, Gift, Lock, Palette } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isThemeUnlocked, THEME_METADATA, type ThemeId } from "@/lib/templates/theme-ids";
import { cn } from "@/lib/utils/cn";

interface ThemeStepProps {
  initialTheme?: ThemeId;
  onContinue: (themeId: ThemeId) => void;
  /** User's current referral count for theme unlock status */
  referralCount?: number;
  /** Whether user has pro status (unlocks all themes) */
  isPro?: boolean;
}

/**
 * Step 4: Theme Selection Component
 * Allows users to choose their resume template design
 */
export function ThemeStep({
  initialTheme = "minimalist_editorial",
  onContinue,
  referralCount = 0,
  isPro = false,
}: ThemeStepProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(initialTheme);

  const handleContinue = () => {
    onContinue(selectedTheme);
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
            const themeId = id as ThemeId;
            const isUnlocked = isThemeUnlocked(themeId, referralCount, isPro);
            const requiredReferrals = meta.referralsRequired;

            return (
              <Card
                key={id}
                onClick={() => isUnlocked && setSelectedTheme(themeId)}
                className={cn(
                  "group relative overflow-hidden transition-colors p-6 shadow-sm",
                  isUnlocked
                    ? selectedTheme === id
                      ? "ring-2 ring-brand border-brand bg-brand-subtle cursor-pointer"
                      : "border-border hover:border-border-strong bg-card cursor-pointer"
                    : "border-border bg-surface-2 cursor-not-allowed opacity-75",
                )}
              >
                {/* Selected Indicator */}
                {selectedTheme === id && isUnlocked && (
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
                        isUnlocked && selectedTheme === id
                          ? "bg-brand text-brand-foreground"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {meta.category}
                    </span>
                    {!isUnlocked && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                        <Gift className="w-3 h-3" />
                        Locked
                      </span>
                    )}
                  </div>

                  {/* Theme Name */}
                  <h3
                    className={cn(
                      "text-xl font-bold transition-colors",
                      isUnlocked && selectedTheme === id ? "text-brand" : "text-foreground",
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
                        isUnlocked && selectedTheme === id ? "border-brand" : "border-border",
                      )}
                    >
                      <img
                        src={meta.preview}
                        alt={`${meta.name} preview`}
                        className={cn(
                          "w-full h-full object-cover object-top",
                          !isUnlocked && "blur-[2px] grayscale",
                        )}
                        loading="lazy"
                      />
                      {/* Lock Overlay for locked themes */}
                      {!isUnlocked && (
                        <div className="absolute inset-0 bg-foreground/40 flex flex-col items-center justify-center">
                          <Lock className="w-5 h-5 text-background mb-1" />
                          <span className="text-[10px] text-background font-semibold">
                            {requiredReferrals} referrals
                          </span>
                        </div>
                      )}
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
          <Button onClick={handleContinue} className="w-full" size="lg">
            Complete Setup
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
