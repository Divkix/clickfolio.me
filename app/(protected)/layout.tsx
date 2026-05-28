import type { Metadata } from "next";
import { SidebarLayoutClient } from "./SidebarLayoutClient";

/** Metadata for all protected routes — disallow search indexing. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Layout wrapper for authenticated routes.
 * Renders a sidebar navigation with the page content.
 */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <SidebarLayoutClient>{children}</SidebarLayoutClient>;
}
