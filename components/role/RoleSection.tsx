import Link from "next/link";
import type { ReactNode } from "react";
import { getPostBySlug } from "@/lib/blog/posts";

export interface RoleItem {
  lead: string;
  body: string;
}

export function RoleList({ items }: { items: RoleItem[] }) {
  return (
    <ul className="space-y-3 text-muted-foreground list-disc pl-5">
      {items.map((item) => (
        <li key={item.lead}>
          <strong>{item.lead}</strong>
          {` — ${item.body}`}
        </li>
      ))}
    </ul>
  );
}

export function RoleSection({
  heading,
  intro,
  items,
  outro,
}: {
  heading: string;
  intro?: ReactNode;
  items?: RoleItem[];
  outro?: ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="font-bold text-xl text-foreground mb-4">{heading}</h2>
      {intro ? <p className="text-muted-foreground mb-4">{intro}</p> : null}
      {items ? <RoleList items={items} /> : null}
      {outro ? <p className="text-muted-foreground">{outro}</p> : null}
    </section>
  );
}

export function RoleGuides({
  heading = "Related guides",
  slugs,
}: {
  heading?: string;
  slugs: string[];
}) {
  const guides = slugs.flatMap((slug) => getPostBySlug(slug) ?? []);

  if (guides.length === 0) {
    return null;
  }

  return (
    <section className="mb-12">
      <h2 className="font-bold text-xl text-foreground mb-4">{heading}</h2>
      <ul className="space-y-3 text-muted-foreground list-disc pl-5">
        {guides.map((guide) => (
          <li key={guide.slug}>
            <Link className="underline" href={`/blog/${guide.slug}`}>
              {guide.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
