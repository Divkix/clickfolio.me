import { env } from "cloudflare:workers";
import { requireAdminAuth } from "@/lib/auth/admin";
import { adminResumesParamsSchema, loadAdminResumes } from "@/lib/data/admin-resumes";
import { Db } from "@/lib/effect/db";
import { runPage } from "@/lib/effect/edges";
import AdminResumesClient from "./AdminResumesClient";

export const dynamic = "force-dynamic";

export default async function AdminResumesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminAuth();
  const params = adminResumesParamsSchema.parse(await searchParams);
  const data = await runPage(loadAdminResumes(params), Db.layer(env.HYPERDRIVE));

  return <AdminResumesClient data={data} statusFilter={params.status} />;
}
