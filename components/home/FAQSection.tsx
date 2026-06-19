import Link from "next/link";
import { FAQ_ITEMS } from "@/lib/config/faq";

/**
 * Condensed FAQ for the homepage. Shows the first handful of questions and
 * links to the full /faq page.
 */
export function FAQSection() {
  const items = FAQ_ITEMS.slice(0, 6);

  return (
    <section className="mt-20 lg:mt-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Frequently asked questions
        </h2>
        <Link
          href="/faq"
          className="text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          See all
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((faq) => (
          <div key={faq.q} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-semibold">{faq.q}</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">{faq.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
