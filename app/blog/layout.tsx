import type { Metadata } from "next";
import { siteConfig } from "@/lib/config/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Guides, comparisons, and tips for building your online portfolio. Learn how to turn your PDF resume into a professional website.",
  alternates: { canonical: `${siteConfig.url}/blog` },
  openGraph: {
    title: `Blog | ${siteConfig.fullName}`,
    description: "Guides, comparisons, and tips for building your online portfolio.",
    siteName: siteConfig.fullName,
    images: [{ url: "/api/og/home", width: 1200, height: 630 }],
  },
  robots: { index: true, follow: true },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-cream paper-texture" id="main-content">
      {children}
    </main>
  );
}
