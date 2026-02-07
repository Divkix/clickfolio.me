"use client";

import { CheckCircle2, Gift, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { TEMPLATE_BACKGROUNDS } from "@/lib/templates/demo-data";
import {
  DYNAMIC_TEMPLATES,
  isThemeUnlocked,
  THEME_IDS,
  THEME_METADATA,
  type ThemeId,
} from "@/lib/templates/theme-registry";
import type { ResumeContent } from "@/lib/types/database";
import { cn } from "@/lib/utils";

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

interface ErrorResponse {
  error?: string;
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
        const errorData = (await response.json()) as ErrorResponse;
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
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 p-3 bg-coral/10 border border-coral/30 rounded-lg text-coral text-sm">
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Thumbnail Strip */}
      <div
        className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0"
        role="listbox"
        aria-label="Theme selection"
        onKeyDown={handleKeyDown}
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
                role="option"
                aria-selected={isSelected}
                aria-disabled={!isUnlocked}
                onClick={() => isUnlocked && setSelectedTheme(themeId)}
                className={cn(
                  "relative shrink-0 w-28 md:w-36 rounded-lg overflow-hidden transition-all duration-200",
                  "border-2 bg-card",
                  "focus:outline-none focus:ring-2 focus:ring-coral focus:ring-offset-2",
                  isUnlocked
                    ? isSelected
                      ? "border-coral ring-2 ring-coral/20 shadow-lg"
                      : "border-ink/15 hover:border-ink/25 hover:shadow-md cursor-pointer"
                    : "border-ink/15 opacity-75 cursor-not-allowed",
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
                    <div className="absolute inset-0 bg-ink/40 flex flex-col items-center justify-center">
                      <Lock className="w-5 h-5 text-white mb-1" />
                      <span className="text-[10px] text-white font-semibold">
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
                    <span className="inline-block mt-1 text-[10px] md:text-xs font-bold text-coral uppercase tracking-wide">
                      Active
                    </span>
                  )}
                  {!isUnlocked && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] md:text-xs font-medium text-amber">
                      <Gift className="w-3 h-3" />
                      Locked
                    </span>
                  )}
                </div>

                {/* Selection Indicator */}
                {isSelected && isUnlocked && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-coral rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-card rounded-xl border border-ink/15 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {THEME_METADATA[selectedTheme].name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {THEME_METADATA[selectedTheme].description}
          </p>
          <span className="inline-block mt-1 text-xs uppercase tracking-wide text-muted-foreground font-medium">
            {THEME_METADATA[selectedTheme].category}
          </span>
        </div>

        {hasChanges && (
          <button
            type="button"
            onClick={handleApplyTheme}
            disabled={isUpdating}
            className={cn(
              "inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm",
              "bg-ink text-cream hover:bg-ink/90",
              "focus:outline-none focus:ring-2 focus:ring-coral focus:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors duration-200",
            )}
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying...
              </>
            ) : (
              "Apply Theme"
            )}
          </button>
        )}
      </div>

      {/* Live Preview Pane */}
      <div
        ref={previewContainerRef}
        className={cn(
          "relative rounded-xl border border-ink/15 overflow-hidden shadow-lg",
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
