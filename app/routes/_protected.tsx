import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { SidebarLayout } from "@/components/dashboard/SidebarLayout";
import { ProtectedError } from "@/components/errors/ProtectedError";
import { sidebarPageData } from "@/lib/data/owner-pages";
import { privatePageHead } from "@/lib/seo/page-metadata";

const loadSidebar = createServerFn({ method: "GET" }).handler(() => sidebarPageData());

export const Route = createFileRoute("/_protected")({
  head: () => privatePageHead(),
  loader: () => loadSidebar(),
  errorComponent: ProtectedError,
  component: ProtectedLayout,
});

function ProtectedLayout() {
  const { handle, isAdmin } = Route.useLoaderData();

  return (
    <SidebarLayout handle={handle} isAdmin={isAdmin}>
      <Outlet />
    </SidebarLayout>
  );
}
