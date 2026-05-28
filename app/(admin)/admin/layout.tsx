import type { Metadata } from "next";
import { requireAdminAuth } from "@/lib/auth/admin";
import { siteConfig } from "@/lib/config/site";
import { AdminLayoutClient } from "./layout-client";

/** Metadata for the admin section — disallowed from indexing. */
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  robots: { index: false, follow: false },
};

/**
 * Admin layout — ensures the user is authenticated as an admin before rendering.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminAuth();
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
