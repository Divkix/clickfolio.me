import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { SidebarLayoutClient } from "./SidebarLayoutClient";

// Force dynamic rendering - protected routes require runtime auth context
// which isn't available during build-time prerendering
export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // Use cached session helper to deduplicate auth calls within request
  const session = await getServerSession();

  if (!session) {
    redirect("/");
  }

  return <SidebarLayoutClient>{children}</SidebarLayoutClient>;
}
