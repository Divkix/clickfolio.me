import Link from "next/link";
import type { ReactNode } from "react";
import { getPostBySlug } from "@/lib/blog/posts";
import { PROFESSIONS } from "@/lib/config/professions";
import { EXAMPLE_GALLERIES } from "@/lib/examples/galleries";
import { THEME_METADATA, themeSlug } from "@/lib/templates/theme-ids";

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

export function RoleTemplates({ slug }: { slug: string }) {
  const profession = PROFESSIONS.find((entry) => entry.slug === slug);

  if (!profession) return null;

  const galleries = EXAMPLE_GALLERIES.filter((gallery) => gallery.forSlug === slug);

  return (
    <section className="mb-12">
      <h2 className="font-bold text-xl text-foreground mb-4">Templates for {profession.label}</h2>
      <ul className="space-y-3 text-muted-foreground list-disc pl-5">
        {profession.themes.map((id) => (
          <li key={id}>
            <Link className="underline" href={`/templates/${themeSlug(id)}`}>
              {THEME_METADATA[id].name}
            </Link>
            {` — ${THEME_METADATA[id].description}`}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-muted-foreground">
        <Link className="underline" href="/templates">
          Browse all 14 free templates
        </Link>
      </p>
      {galleries.map((gallery) => (
        <p key={gallery.slug} className="mt-3 text-muted-foreground">
          <Link className="underline" href={`/examples/${gallery.slug}`}>
            {gallery.title}
          </Link>
        </p>
      ))}
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
