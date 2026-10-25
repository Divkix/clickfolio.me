import { Link } from "@tanstack/react-router";
import { siteConfig } from "@/lib/config/site";
import type { ThemeChrome } from "@/lib/templates/theme-chrome";

interface AttributionWidgetProps {
  styles: ThemeChrome["attribution"];
}

export function AttributionWidget({ styles: currentTheme }: AttributionWidgetProps) {
  return (
    <Link
      to="/"
      className={`
        group fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-30
        px-3 py-2 sm:px-4 sm:py-3 rounded-lg
        flex items-center gap-2
        transition-colors duration-300
        overflow-hidden
        ${currentTheme.container}
        ${currentTheme.shadow}
      `}
      aria-label={`Visit ${siteConfig.fullName} homepage`}
    >
      <div
        className={`
          absolute inset-0 bg-linear-to-r
          -translate-x-full group-hover:translate-x-full
          transition-transform duration-700 ease-out
          ${currentTheme.shimmer}
        `}
      />

      <div className="relative z-10 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-medium">
        <span>Built with</span>
        <span className="font-semibold">
          {siteConfig.name}
          <span className={currentTheme.accent}>{siteConfig.tld}</span>
        </span>
      </div>
    </Link>
  );
}
