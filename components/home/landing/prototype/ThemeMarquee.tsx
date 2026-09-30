// PROTOTYPE (throwaway): drop_first's two-row design marquee on theme tokens.
// Hover pauses a row; reduced motion stops it (globals.css).

import { DEMO_PROFILES } from "@/lib/templates/demo-data";
import { THEME_METADATA } from "@/lib/templates/theme-ids";

const previews = DEMO_PROFILES.map((profile) => ({
  src: THEME_METADATA[profile.id].preview,
  theme: THEME_METADATA[profile.id].name,
  name: profile.name,
}));

export const THEME_COUNT = previews.length;

function MarqueeRow({ reverse = false }: { reverse?: boolean }) {
  return (
    <div className="group flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
      {[false, true].map((duplicate) => (
        <ul
          key={String(duplicate)}
          aria-hidden={duplicate || undefined}
          className={`flex shrink-0 gap-6 pr-6 group-hover:[animation-play-state:paused] ${
            reverse ? "animate-landing-marquee-reverse" : "animate-landing-marquee"
          }`}
        >
          {previews.map((item) => (
            <li key={item.src} className="w-64 shrink-0 sm:w-80">
              <img
                src={item.src}
                alt={duplicate ? "" : `${item.theme} design`}
                loading="lazy"
                decoding="async"
                className="aspect-16/10 w-full rounded-md border border-border object-cover object-top shadow-sm"
              />
              <p className="mt-2 flex justify-between text-xs">
                <span className="font-semibold">{item.theme}</span>
                <span className="text-muted-foreground">{item.name}</span>
              </p>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

export function ThemeMarquee() {
  return (
    <div className="space-y-6">
      <MarqueeRow />
      <MarqueeRow reverse />
    </div>
  );
}
