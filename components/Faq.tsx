import { ChevronDown } from "lucide-react";
import { generateFAQPageJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { cn } from "@/lib/utils/cn";

export interface FaqItem {
  q: string;
  a: string;
}

/**
 * Collapsible FAQ accordion (native <details>). Shared by the full FAQ page and
 * blog post layout. Callers supply their own surrounding section + heading.
 */
export function FaqAccordion({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {items.map((faq) => (
        <details
          key={faq.q}
          className="group rounded-xl border border-border bg-card shadow-sm transition-colors open:border-border-strong"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            {faq.q}
            <ChevronDown
              className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <p className="px-6 pb-6 leading-relaxed text-muted-foreground">{faq.a}</p>
        </details>
      ))}
    </div>
  );
}

/**
 * Static (always-expanded) FAQ section used by profession landing pages.
 * Renders the visible Q&A list plus FAQPage JSON-LD in one place.
 */
export function RoleFaqSection({ items }: { items: FaqItem[] }) {
  return (
    <section className="mb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(generateFAQPageJsonLd(items)) }}
      />
      <h2 className="font-bold text-xl text-foreground mb-4">Frequently asked questions</h2>
      <div className="space-y-4">
        {items.map((f) => (
          <div key={f.q}>
            <h3 className="font-semibold text-foreground mb-1">{f.q}</h3>
            <p className="text-muted-foreground">{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
