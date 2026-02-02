import { requireAdminAuth } from "@/lib/auth/admin";
import { AdminLayoutClient } from "./layout-client";

export const runtime = "edge";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminAuth();

  return <AdminLayoutClient adminEmail={admin.email}>{children}</AdminLayoutClient>;
}
