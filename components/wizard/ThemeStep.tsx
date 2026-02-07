"use client";

import { CheckCircle2, Gift, Lock, Palette } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isThemeUnlocked, THEME_METADATA, type ThemeId } from "@/lib/templates/theme-ids";
import { cn } from "@/lib/utils";

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
        <div className="mx-auto w-16 h-16 bg-linear-to-r from-coral/20 to-coral/20 rounded-xl flex items-center justify-center mb-6">
          <Palette className="w-8 h-8 text-coral" />
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
                  "group relative overflow-hidden transition-all duration-300 p-6",
                  "shadow-sm",
                  isUnlocked
                    ? selectedTheme === id
                      ? "border-coral ring-2 ring-coral/20 bg-coral/10 cursor-pointer hover:shadow-lg hover:-translate-y-1"
                      : "border-ink/10 hover:border-coral/40 bg-card cursor-pointer hover:shadow-lg hover:-translate-y-1"
                    : "border-ink/10 bg-muted cursor-not-allowed opacity-75",
                )}
              >
                {/* Selected Indicator */}
                {selectedTheme === id && isUnlocked && (
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
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-block text-xs uppercase tracking-wide font-bold px-2 py-1 rounded",
                        isUnlocked
                          ? selectedTheme === id
                            ? "bg-coral/30 text-coral"
                            : "bg-muted text-muted-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {meta.category}
                    </span>
                    {!isUnlocked && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                        <Gift className="w-3 h-3" />
                        Locked
                      </span>
                    )}
                  </div>

                  {/* Theme Name */}
                  <h3
                    className={cn(
                      "text-xl font-bold transition-colors",
                      isUnlocked
                        ? selectedTheme === id
                          ? "text-coral"
                          : "text-foreground group-hover:text-coral"
                        : "text-muted-foreground",
                    )}
                  >
                    {meta.name}
                  </h3>

                  {/* Description */}
                  <p
                    className={cn(
                      "text-sm leading-relaxed",
                      isUnlocked
                        ? selectedTheme === id
                          ? "text-foreground/80"
                          : "text-muted-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {meta.description}
                  </p>

                  {/* Visual Indicator / Preview */}
                  <div className="pt-2">
                    <div
                      className={cn(
                        "aspect-16/10 rounded-lg overflow-hidden border-2 transition-all relative",
                        isUnlocked
                          ? selectedTheme === id
                            ? "border-coral"
                            : "border-ink/15"
                          : "border-ink/15",
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
                        <div className="absolute inset-0 bg-ink/40 flex flex-col items-center justify-center">
                          <Lock className="w-5 h-5 text-white mb-1" />
                          <span className="text-[10px] text-white font-semibold">
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
            <span className="font-bold text-coral">{THEME_METADATA[selectedTheme].name}</span>
          </p>
        </div>

        {/* Continue Button */}
        <div className="pt-6">
          <Button
            onClick={handleContinue}
            className="w-full bg-linear-to-r from-coral to-coral hover:from-coral/90 hover:to-coral/90 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-300"
            size="lg"
          >
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
