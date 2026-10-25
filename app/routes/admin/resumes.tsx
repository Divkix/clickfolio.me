import { env } from "cloudflare:workers";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod/mini";
import AdminResumesClient from "@/components/admin/AdminResumesClient";
import { requireAdminAuth } from "@/lib/auth/admin";
import { loadAdminResumes } from "@/lib/data/admin-resumes";
import { Db } from "@/lib/effect/db";
import { runPage } from "@/lib/effect/edges";
import { privatePageHead } from "@/lib/seo/page-metadata";

const searchSchema = z.object({
  page: z.catch(z.int().check(z.minimum(1), z.maximum(Number.MAX_SAFE_INTEGER)), 1),
  status: z.catch(z.enum(["all", "completed", "processing", "queued", "failed"]), "all"),
});

const getResumes = createServerFn({ method: "GET" })
  .validator(searchSchema)
  .handler(async ({ data }) => {
    await requireAdminAuth();

    return runPage(loadAdminResumes(data), Db.layer(env.HYPERDRIVE));
  });

export const Route = createFileRoute("/admin/resumes")({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams(searchSchema.parse({}))] },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getResumes({ data: deps }),
  head: () => privatePageHead("Admin Resumes"),
  component: AdminResumesPage,
});

function AdminResumesPage() {
  const data = Route.useLoaderData();
  const { status } = Route.useSearch();

  return <AdminResumesClient data={data} statusFilter={status} />;
}
