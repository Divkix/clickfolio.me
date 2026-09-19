import type { ReactNode } from "react";

interface PostListItem {
  lead: string;
  body: ReactNode;
}

interface PostListProps {
  items: PostListItem[];
  ordered?: boolean;
  className?: string;
}

export function PostList({
  items,
  ordered = false,
  className = ordered ? "list-decimal pl-6 space-y-2" : undefined,
}: PostListProps) {
  const List = ordered ? "ol" : "ul";

  return (
    <List className={className}>
      {items.map((item) => (
        <li key={item.lead}>
          <strong>{item.lead}</strong>
          {item.body}
        </li>
      ))}
    </List>
  );
}

interface PostSectionProps {
  heading: string;
  intro?: string;
  children: ReactNode;
}

export function PostSection({ heading, intro, children }: PostSectionProps) {
  return (
    <section>
      <h2>{heading}</h2>
      {intro ? <p>{intro}</p> : null}
      {children}
    </section>
  );
}
