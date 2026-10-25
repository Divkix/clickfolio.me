import { env } from "cloudflare:workers";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import AdminResumesClient from "@/components/admin/AdminResumesClient";
import { requireAdminAuth } from "@/lib/auth/admin";
import { loadAdminResumes } from "@/lib/data/admin-resumes";
import { Db } from "@/lib/effect/db";
import { runPage } from "@/lib/effect/edges";
import { privatePageHead } from "@/lib/seo/page-metadata";

const searchSchema = z.object({
  page: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).catch(1),
  status: z.enum(["all", "completed", "processing", "queued", "failed"]).catch("all"),
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
