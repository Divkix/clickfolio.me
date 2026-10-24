import type { ComponentProps } from "react";

export const LINK_REL = "ugc nofollow noopener noreferrer";

type ExternalLinkProps = Omit<ComponentProps<"a">, "target" | "rel">;

export function ExternalLink({ children, ...props }: ExternalLinkProps) {
  return (
    <a {...props} target="_blank" rel={LINK_REL}>
      {children}
    </a>
  );
}

export function MaybeLink({
  href,
  children,
  ...props
}: Omit<ExternalLinkProps, "href"> & { href?: string | null }) {
  return href ? (
    <ExternalLink {...props} href={href}>
      {children}
    </ExternalLink>
  ) : (
    children
  );
}
