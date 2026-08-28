import { generateBreadcrumbListJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";

export interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /**
   * Emit BreadcrumbList JSON-LD matching the visible crumbs. Default true so
   * `/explore`, `/blog`, privacy, and terms stay in sync with the on-page nav.
   * Profile pages pass false — they already emit Home > Explore > displayName
   * via `generateBreadcrumbJsonLd` (visible last crumb is `@handle`).
   */
  includeJsonLd?: boolean;
}

export function Breadcrumb({ items, includeJsonLd = true }: BreadcrumbProps) {
  const jsonLd = includeJsonLd
    ? generateBreadcrumbListJsonLd(items.map((item) => ({ name: item.label, path: item.href })))
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      )}
      <nav aria-label="Breadcrumb" className="py-3 px-4 max-w-6xl mx-auto">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {items.map((item, i) => (
            <li key={item.href} className="flex items-center gap-1">
              {i < items.length - 1 ? (
                <>
                  <a
                    href={item.href}
                    className="underline underline-offset-2 transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </a>
                  <span aria-hidden="true" className="mx-1">
                    /
                  </span>
                </>
              ) : (
                <span className="font-medium text-foreground" aria-current="page">
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
