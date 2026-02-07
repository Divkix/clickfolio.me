import Link from "next/link";
import { LoginButton } from "@/components/auth/LoginButton";
import { Logo } from "@/components/Logo";

/**
 * Shared sticky header used on homepage and explore pages.
 * Server component — LoginButton is the only client boundary.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b-3 border-ink bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <a href="/" aria-label="clickfolio.me home">
          <Logo size="md" />
        </a>
        <div className="flex items-center gap-4">
          <Link
            href="/explore"
            className="font-mono text-sm text-ink/70 hover:text-ink underline-offset-4 hover:underline transition-colors uppercase tracking-wide"
          >
            Explore
          </Link>
          <LoginButton />
        </div>
      </div>
    </header>
  );
}
