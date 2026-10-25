import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { publicPageHead } from "@/lib/seo/page-metadata";

export const Route = createFileRoute("/blog")({
  head: () =>
    publicPageHead({
      title: "Resume website guides",
      description:
        "Guides, comparisons, and tips for building your online portfolio. Learn how to turn your PDF resume into a professional website.",
      path: "/blog",
      robots: "index, follow",
    }),
  component: BlogLayout,
});

function BlogLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
