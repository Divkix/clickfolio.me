import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
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
 * Blog section layout — same public nav (Explore / Blog / FAQ / About) as the
 * rest of the marketing site. Listing and posts keep their own `<main>`.
 */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <Footer />
    </div>
  );
}
