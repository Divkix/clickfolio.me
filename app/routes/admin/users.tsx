import { env } from "cloudflare:workers";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import AdminUsersClient from "@/components/admin/AdminUsersClient";
import { requireAdminAuth } from "@/lib/auth/admin";
import { loadAdminUsers } from "@/lib/data/admin-users";
import { Db } from "@/lib/effect/db";
import { runPage } from "@/lib/effect/edges";
import { privatePageHead } from "@/lib/seo/page-metadata";

const searchSchema = z.object({
  page: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).catch(1),
  search: z.string().trim().catch(""),
});

const getUsers = createServerFn({ method: "GET" })
  .validator(searchSchema)
  .handler(async ({ data }) => {
    await requireAdminAuth();

    return runPage(loadAdminUsers(data), Db.layer(env.HYPERDRIVE));
  });

export const Route = createFileRoute("/admin/users")({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams(searchSchema.parse({}))] },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getUsers({ data: deps }),
  head: () => privatePageHead("Admin Users"),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const data = Route.useLoaderData();
  const { page, search } = Route.useSearch();

  return <AdminUsersClient key={`${page} ${search}`} data={data} search={search} />;
}
