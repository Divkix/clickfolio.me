"use client";

import { CheckCircle2, Gift, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TEMPLATE_BACKGROUNDS } from "@/lib/templates/demo-data";
import {
  isThemeUnlocked,
  THEME_IDS,
  THEME_METADATA,
  type ThemeId,
} from "@/lib/templates/theme-ids";
import { DYNAMIC_TEMPLATES } from "@/lib/templates/theme-registry.client";
import type { ApiErrorBody } from "@/lib/types/api";
import type { ResumeContent } from "@/lib/types/database";
import { cn } from "@/lib/utils/cn";

interface ThemeSelectorProps {
  initialThemeId: string;
  initialContent: ResumeContent;
  profile: {
    handle: string;
    avatar_url: string | null;
  };
  /** User's current referral count for theme unlock status */
  referralCount: number;
  /** Whether user has pro status (unlocks all themes) */
  isPro: boolean;
}

export function ThemeSelector({
  initialThemeId,
  initialContent,
  profile,
  referralCount,
  isPro,
}: ThemeSelectorProps) {
  const router = useRouter();
  const [savedTheme, setSavedTheme] = useState<ThemeId>(initialThemeId as ThemeId);
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(initialThemeId as ThemeId);
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Scale calculation for live preview
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  // Calculate scale based on container width
  const calculateScale = useCallback(() => {
    if (previewContainerRef.current) {
      const containerWidth = previewContainerRef.current.offsetWidth;
      // Template is designed for 1280px width
      const newScale = Math.min(containerWidth / 1280, 1);
      setScale(newScale);
    }
  }, []);

  useEffect(() => {
    calculateScale();
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, [calculateScale]);

  // Handle keyboard navigation for thumbnail strip
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = THEME_IDS.indexOf(selectedTheme);
      if (e.key === "ArrowRight" && currentIndex < THEME_IDS.length - 1) {
        setSelectedTheme(THEME_IDS[currentIndex + 1]);
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        setSelectedTheme(THEME_IDS[currentIndex - 1]);
      }
    },
    [selectedTheme],
  );

  async function handleApplyTheme() {
    if (selectedTheme === savedTheme) return;

    setIsUpdating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/resume/update-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme_id: selectedTheme }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ApiErrorBody;
        throw new Error(errorData.error || "Failed to update theme");
      }

      setSavedTheme(selectedTheme);
      setSuccessMessage(`Theme updated to ${THEME_METADATA[selectedTheme].name}`);

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

  // Get the dynamic template component for the selected theme
  const SelectedTemplate = DYNAMIC_TEMPLATES[selectedTheme];
  const bgConfig = TEMPLATE_BACKGROUNDS[selectedTheme];
  const hasChanges = selectedTheme !== savedTheme;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-2">
          Choose Your Theme
        </h1>
        <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
          Preview how your resume looks with different styles. Click a theme to preview, then apply
          it.
        </p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/30 rounded-lg text-success text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Thumbnail Strip */}
      <div
        className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0"
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom keyboard-navigable theme strip; native select would not support thumbnail previews
        role="listbox"
        aria-label="Theme selection"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="flex gap-3 min-w-max">
          {THEME_IDS.map((themeId) => {
            const meta = THEME_METADATA[themeId];
            const isSelected = selectedTheme === themeId;
            const isActive = savedTheme === themeId;
            const isUnlocked = isThemeUnlocked(themeId, referralCount, isPro);
            const requiredReferrals = meta.referralsRequired;

            return (
              <button
                key={themeId}
                type="button"
                // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- button with role="option" inside listbox is correct ARIA pattern
                role="option"
                aria-selected={isSelected}
                aria-disabled={!isUnlocked}
                onClick={() => isUnlocked && setSelectedTheme(themeId)}
                className={cn(
                  "relative shrink-0 w-28 md:w-36 rounded-lg overflow-hidden transition-colors",
                  "border bg-card",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isUnlocked
                    ? isSelected
                      ? "border-brand ring-2 ring-brand/30 shadow-md"
                      : "border-border hover:border-border-strong cursor-pointer"
                    : "border-border opacity-75 cursor-not-allowed",
                )}
              >
                {/* Thumbnail Image */}
                <div className="aspect-4/3 bg-muted overflow-hidden relative">
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
                      <Lock className="w-5 h-5 text-background mb-1" aria-hidden="true" />
                      <span className="text-[10px] text-background font-semibold">
                        {requiredReferrals} referrals
                      </span>
                    </div>
                  )}
                </div>

                {/* Theme Name */}
                <div className="p-2 text-center">
                  <span
                    className={cn(
                      "text-xs md:text-sm font-semibold truncate block",
                      isUnlocked ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {meta.name}
                  </span>
                  {isActive && isUnlocked && (
                    <span className="inline-block mt-1 text-[10px] md:text-xs font-semibold text-brand">
                      Active
                    </span>
                  )}
                  {!isUnlocked && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] md:text-xs font-medium text-warning">
                      <Gift className="w-3 h-3" aria-hidden="true" />
                      Locked
                    </span>
                  )}
                </div>

                {/* Selection Indicator */}
                {isSelected && isUnlocked && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-brand rounded-full flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-brand-foreground"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <title>Selected</title>
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Theme Info + Apply Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-card rounded-xl border border-border shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {THEME_METADATA[selectedTheme].name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {THEME_METADATA[selectedTheme].description}
          </p>
          <span className="inline-block mt-1 text-xs text-muted-foreground font-medium">
            {THEME_METADATA[selectedTheme].category}
          </span>
        </div>

        {hasChanges && (
          <Button type="button" onClick={handleApplyTheme} loading={isUpdating}>
            {isUpdating ? "Applying..." : "Apply Theme"}
          </Button>
        )}
      </div>

      {/* Live Preview Pane */}
      <div
        ref={previewContainerRef}
        className={cn(
          "relative rounded-xl border border-border overflow-hidden shadow-md",
          bgConfig.bg,
        )}
        style={{ height: "60vh", minHeight: "400px" }}
      >
        {/* Scaled Template Wrapper */}
        <div className="absolute inset-0 overflow-auto">
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: "1280px",
            }}
            className="pointer-events-none"
          >
            <SelectedTemplate content={initialContent} profile={profile} />
          </div>
        </div>

        {/* Preview Badge */}
        <div className="absolute bottom-4 right-4 z-10">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-black/60 text-white backdrop-blur-sm">
            Live Preview
          </span>
        </div>
      </div>
    </div>
  );
}
