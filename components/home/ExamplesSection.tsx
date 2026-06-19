"use client";

import { ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { DemoProfile } from "@/lib/templates/demo-data";
import { THEME_METADATA } from "@/lib/templates/theme-ids";

const TemplatePreviewModal = dynamic(
  () =>
    import("@/components/templates/TemplatePreviewModal").then(
      (module) => module.TemplatePreviewModal,
    ),
  { ssr: false },
);

interface ExamplesSectionProps {
  profiles: DemoProfile[];
}

export function ExamplesSection({ profiles }: ExamplesSectionProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  return (
    <>
      <section id="examples" className="mt-20 lg:mt-28">
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Choose from {profiles.length} themes
        </h2>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Every template is responsive, fast, and yours to switch anytime.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {profiles.map((profile, index) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => setPreviewIndex(index)}
              className="group overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="aspect-4/3 overflow-hidden border-b border-border bg-surface-2">
                <img
                  src={THEME_METADATA[profile.id].preview}
                  alt={`${profile.name} - ${profile.badgeLabel} template`}
                  className="size-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand-active">
                    {profile.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{profile.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{profile.role}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{profile.badgeLabel}</Badge>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-brand">
                    View
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Template Preview Modal */}
      {previewIndex !== null && (
        <TemplatePreviewModal
          isOpen
          onClose={() => setPreviewIndex(null)}
          selectedIndex={previewIndex}
          onNavigate={setPreviewIndex}
        />
      )}
    </>
  );
}
