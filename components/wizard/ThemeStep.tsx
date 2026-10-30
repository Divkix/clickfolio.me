import { CheckCircle2, Palette } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { previewSrcSet, THEME_METADATA, type ThemeId } from "@/lib/templates/theme-ids";
import { siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";

interface ThemeStepProps {
  handle: string;
  initialTheme?: ThemeId;
  onContinue: (themeId: ThemeId) => void | Promise<void>;
}

export function ThemeStep({
  handle,
  initialTheme = "minimalist_editorial",
  onContinue,
}: ThemeStepProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(initialTheme);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await onContinue(selectedTheme);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-[calc(18rem+env(safe-area-inset-bottom))] sm:pb-[calc(12rem+env(safe-area-inset-bottom))]">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-brand-subtle rounded-xl flex items-center justify-center mb-6">
          <Palette className="w-8 h-8 text-brand" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 leading-tight">
          Choose Your Template
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Choose a template for your page. You can change it later.
        </p>
      </div>

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
                {selectedTheme === id && (
                  <div className="absolute top-4 right-4">
                    <div className="flex items-center gap-1 bg-brand text-brand-foreground px-3 py-1 rounded-full text-xs font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      Selected
                    </div>
                  </div>
                )}

                <div className="space-y-3">
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

                  <h3
                    className={cn(
                      "text-xl font-bold transition-colors",
                      selectedTheme === id ? "text-brand" : "text-foreground",
                    )}
                  >
                    {meta.name}
                  </h3>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {meta.description}
                  </p>

                  <div className="pt-2">
                    <div
                      className={cn(
                        "aspect-16/10 rounded-lg overflow-hidden border transition-colors relative",
                        selectedTheme === id ? "border-brand" : "border-border",
                      )}
                    >
                      <img
                        src={meta.preview}
                        srcSet={previewSrcSet(meta.preview)}
                        sizes="(min-width: 768px) 50vw, 100vw"
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
      </div>

      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:left-60">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Selected template:{" "}
              <span className="font-bold text-brand">{THEME_METADATA[selectedTheme].name}</span>
            </p>
            <Button
              onClick={handleContinue}
              disabled={isSubmitting}
              loading={isSubmitting}
              className="w-full sm:w-auto"
              size="lg"
              aria-describedby="publish-visibility-note"
            >
              {isSubmitting ? "Publishing..." : "Publish my page"}
            </Button>
          </div>
          <p id="publish-visibility-note" className="text-sm text-muted-foreground">
            Publishing makes{" "}
            <span className="font-medium break-all">
              {siteConfig.domain}/@{handle}
            </span>{" "}
            public. Anyone with the link can view it. You can change the template, content and
            privacy later in your dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
