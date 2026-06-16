/**
 * Shared font-link scaffolding for resume templates.
 *
 * Every template loads Google Fonts via the same three-tag pattern:
 *   1. preconnect to fonts.googleapis.com
 *   2. preconnect to fonts.gstatic.com (crossOrigin)
 *   3. stylesheet link for the template's own font family URL
 *
 * Pass the full `css2?family=…&display=swap` URL as `href`.
 */

export function TemplateFontLinks({ href }: { href: string }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={href} />
    </>
  );
}
