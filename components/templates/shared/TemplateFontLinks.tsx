import { preload } from "react-dom";

// Load the Google Fonts sheet through CSS @import, not <link rel="stylesheet">.
// Cloudflare Fonts rewrites Google Fonts <link> tags into inline <style> at the
// edge, so the served HTML stops matching the React tree and every template
// fails hydration (React #418). It leaves @import untouched. The preload hint
// keeps the early fetch the stylesheet link used to trigger.
export function TemplateFontLinks({ href }: { href: string }) {
  preload(href, { as: "style" });

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <style>{`@import url("${href}");`}</style>
    </>
  );
}
