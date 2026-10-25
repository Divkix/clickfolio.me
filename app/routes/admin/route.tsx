import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AdminLayoutClient } from "@/components/admin/AdminLayout";
import { requireAdminAuth } from "@/lib/auth/admin";
import { privatePageHead } from "@/lib/seo/page-metadata";

const requireAdmin = createServerFn({ method: "GET" }).handler(() => requireAdminAuth());

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    await requireAdmin();
  },
  head: () => privatePageHead("Admin"),
  component: () => (
    <AdminLayoutClient>
      <Outlet />
    </AdminLayoutClient>
  ),
});
