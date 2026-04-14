import { requireAdminAuth } from "@/lib/auth/admin";
import { AdminLayoutClient } from "./layout-client";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminAuth();
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
