import type { Metadata } from "next";
import { buildPublicPageMetadata } from "@/lib/seo/page-metadata";

/** SEO metadata fallback for the blog section (listing + posts override). */
export const metadata: Metadata = {
  ...buildPublicPageMetadata({
    title: "Resume website guides",
    description:
      "Guides, comparisons, and tips for building your online portfolio. Learn how to turn your PDF resume into a professional website.",
    path: "/blog",
  }),
  robots: { index: true, follow: true },
};

/**
 * Blog section layout — simple wrapper with consistent background styling.
 */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background" id="main-content">
      {children}
    </main>
  );
}
