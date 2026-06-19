export interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
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
  );
}
