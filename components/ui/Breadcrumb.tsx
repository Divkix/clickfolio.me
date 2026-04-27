export interface BreadcrumbItem {
  label: string;
  href: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="py-3 px-4 max-w-6xl mx-auto">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-[#6B6B6B]">
        {items.map((item, i) => (
          <li key={item.href} className="flex items-center gap-1">
            {i < items.length - 1 ? (
              <>
                <a
                  href={item.href}
                  className="hover:text-ink transition-colors underline underline-offset-2"
                >
                  {item.label}
                </a>
                <span aria-hidden="true" className="mx-1">
                  /
                </span>
              </>
            ) : (
              <span className="text-ink font-medium" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
