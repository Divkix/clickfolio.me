import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getPostBySlug } from "@/lib/blog/posts";

const GUIDE_SLUGS = [
  "linkedin-to-portfolio",
  "best-resume-website-builders",
  "resume-website-examples",
  "personal-resume-website",
];

const guides = GUIDE_SLUGS.flatMap((slug) => getPostBySlug(slug) ?? []);

export function PopularGuides() {
  return (
    <section className="mt-20 lg:mt-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Popular guides
        </h2>
        <Link
          href="/blog"
          className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          All guides
        </Link>
      </div>

      <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {guides.map((guide) => (
          <li key={guide.slug}>
            <Link
              href={`/blog/${guide.slug}`}
              className="group flex h-full items-start justify-between gap-4 rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <span>
                <span className="text-xs font-semibold tracking-widest text-brand uppercase">
                  {guide.category}
                </span>
                <span className="mt-2 block font-semibold transition-colors group-hover:text-brand">
                  {guide.title}
                </span>
              </span>
              <ArrowRight
                aria-hidden="true"
                className="mt-6 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brand"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
