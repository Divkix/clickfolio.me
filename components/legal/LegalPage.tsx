import Link from "next/link";
import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { Breadcrumb } from "@/components/ui/breadcrumb";

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  breadcrumbLabel: string;
  breadcrumbHref: string;
  jsonLd: ReactNode;
  sections: { title: string; body: ReactNode }[];
}

interface LegalSectionProps {
  index: number;
  title: string;
  isLast: boolean;
  children: ReactNode;
}

export function LegalSection({ index, title, isLast, children }: LegalSectionProps) {
  return (
    <section id={`section-${index + 1}`} className={isLast ? "mb-4" : "mb-10"}>
      <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-3">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-subtle text-brand-active text-sm font-semibold">
          {index + 1}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LegalPage({
  title,
  lastUpdated,
  breadcrumbLabel,
  breadcrumbHref,
  jsonLd,
  sections,
}: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {jsonLd}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/"
            className="hover:opacity-80 transition-opacity"
            aria-label="clickfolio.me home"
          >
            <Logo size="md" />
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </header>

      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: breadcrumbLabel, href: breadcrumbHref },
        ]}
      />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <article className="max-w-3xl mx-auto">
          <div className="mb-12 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 tracking-tight">
              {title}
            </h1>
            <p className="text-muted-foreground text-sm">{lastUpdated}</p>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm p-8 sm:p-12">
            <nav
              className="mb-10 p-6 rounded-lg bg-surface-2 border border-border"
              aria-label="Table of contents"
            >
              <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">
                Contents
              </h2>
              <ol className="space-y-2 text-sm">
                {sections.map((section, index) => (
                  <li key={section.title}>
                    <a
                      href={`#section-${index + 1}`}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {index + 1}. {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="prose max-w-none">
              {sections.map((section, index) => (
                <LegalSection
                  key={section.title}
                  index={index}
                  title={section.title}
                  isLast={index === sections.length - 1}
                >
                  {section.body}
                </LegalSection>
              ))}
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Home
            </Link>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
