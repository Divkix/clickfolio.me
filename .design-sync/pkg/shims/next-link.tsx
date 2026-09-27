// Design-sync shim: next/link renders a plain anchor outside the Next router.
import { forwardRef, type AnchorHTMLAttributes } from "react";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string };
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
};

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, prefetch: _p, replace: _r, scroll: _s, ...rest },
  ref,
) {
  const to = typeof href === "string" ? href : (href.pathname ?? "#");
  return <a ref={ref} href={to} {...rest} />;
});

export default Link;
