import { Github } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/Brand";

/**
 * Footer component with legal links
 * Matches the "Soft Depth" theme from the landing page
 */
export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-depth-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>&copy; {currentYear}</span>
            <Brand size="sm" />
          </div>
          <nav className="flex items-center gap-6" aria-label="Footer navigation">
            <Link
              href="/terms"
              className="text-sm text-slate-600 hover:text-indigo-600 transition-colors duration-300"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-slate-600 hover:text-indigo-600 transition-colors duration-300"
            >
              Privacy Policy
            </Link>
          </nav>
        </div>
        <p className="text-center text-slate-500 text-xs font-medium mt-4 flex items-center justify-center gap-1">
          Built with Next.js | Powered by Cloudflare |{" "}
          <a
            href="https://github.com/divkix/webresume.now"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-indigo-600 transition-colors"
          >
            <Github className="h-3 w-3" />
            Open Source
          </a>
        </p>
      </div>
    </footer>
  );
}
