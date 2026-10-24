import { env } from "cloudflare:workers";
import { requireAdminAuth } from "@/lib/auth/admin";
import { adminUsersParamsSchema, loadAdminUsers } from "@/lib/data/admin-users";
import { Db } from "@/lib/effect/db";
import { runPage } from "@/lib/effect/edges";
import AdminUsersClient from "./AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminAuth();
  const params = adminUsersParamsSchema.parse(await searchParams);
  const data = await runPage(loadAdminUsers(params), Db.layer(env.HYPERDRIVE));

  return (
    <AdminUsersClient key={`${params.page} ${params.search}`} data={data} search={params.search} />
  );
}
