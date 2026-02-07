"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { DemoProfile } from "@/lib/templates/demo-data";
import { THEME_METADATA } from "@/lib/templates/theme-ids";

const TemplatePreviewModal = dynamic(
  () =>
    import("@/components/templates/TemplatePreviewModal").then(
      (module) => module.TemplatePreviewModal,
    ),
  { ssr: false },
);

export function ExamplesSection({ profiles }: { profiles: DemoProfile[] }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  return (
    <>
      <section id="examples" className="mt-16 lg:mt-20">
        <div className="flex items-center gap-4 mb-8">
          <h2 className="font-black text-2xl sm:text-3xl text-ink">
            Choose from {profiles.length} themes
          </h2>
          <div className="flex-1 h-1 bg-ink" />
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {profiles.map((profile, index) => {
            const cardColors = [
              { avatar: "bg-coral text-white", badge: "bg-coral/10 text-coral" },
              { avatar: "bg-mint text-ink", badge: "bg-mint/10 text-ink" },
              { avatar: "bg-lavender text-white", badge: "bg-lavender/10 text-lavender" },
              { avatar: "bg-amber text-ink", badge: "bg-amber/10 text-ink" },
            ];
            const color = cardColors[index % cardColors.length];
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => setPreviewIndex(index)}
                className={`
                      group
                      bg-white
                      border-3
                      border-ink
                      p-0
                      overflow-hidden
                      shadow-brutal-sm
                      hover-brutal-shift
                      text-left
                      animate-fade-in-up
                      focus:outline-none
                      focus:ring-4
                      focus:ring-coral
                      w-full
                      sm:w-[calc(50%-0.5rem)]
                      lg:w-[calc(25%-0.75rem)]
                    `}
                style={{ animationDelay: `${(index + 4) * 100}ms` }}
              >
                <div className="border-b-3 border-ink overflow-hidden bg-cream aspect-4/3">
                  <img
                    src={THEME_METADATA[profile.id].preview}
                    alt={`${profile.name} - ${profile.badgeLabel} template`}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`
                            w-12
                            h-12
                            rounded-full
                            border-3
                            border-ink
                            flex
                            items-center
                            justify-center
                            font-black
                            text-sm
                            ${color.avatar}
                          `}
                    >
                      {profile.initials}
                    </div>
                    <div>
                      <div className="font-bold text-ink">{profile.name}</div>
                      <div className="font-mono text-xs text-[#6B6B6B]">{profile.role}</div>
                    </div>
                  </div>
                  <div
                    className={`
                          inline-block
                          px-2
                          py-1
                          border-2
                          border-ink
                          font-mono
                          text-xs
                          uppercase
                          tracking-wide
                          ${color.badge}
                        `}
                  >
                    {profile.badgeLabel}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[#6B6B6B] group-hover:text-ink transition-colors">
                    <span className="font-mono text-xs">View template</span>
                    <svg
                      className="w-4 h-4 transform group-hover:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
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
