import type { ReactNode } from "react";

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
