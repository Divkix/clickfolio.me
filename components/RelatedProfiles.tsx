import Link from "next/link";

interface Props {
  profiles: Array<{ handle: string; name: string; headline?: string | null }>;
}

/**
 * Cross-linking widget for public profile pages.
 * Helps crawlability by linking related portfolios.
 */
export function RelatedProfiles({ profiles }: Props) {
  if (!profiles.length) return null;

  return (
    <section aria-label="Related portfolios" className="max-w-4xl mx-auto px-6 py-8">
      <div className="border border-border rounded-xl bg-card shadow-sm px-6 py-5">
        <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase mb-3">
          More Portfolios
        </h2>
        <ul className="space-y-2">
          {profiles.map((p) => (
            <li key={p.handle}>
              <Link
                href={`/@${p.handle}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="font-medium">{p.name}</span>
                {p.headline ? ` — ${p.headline}` : ""}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
