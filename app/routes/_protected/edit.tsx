import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ProtectedError } from "@/components/errors/ProtectedError";
import { Skeleton } from "@/components/ui/skeleton";
import { EditResumeFormWrapper } from "@/components/forms/EditResumeFormWrapper";
import { editPageData } from "@/lib/data/owner-pages";
import { privatePageHead } from "@/lib/seo/page-metadata";

const getEdit = createServerFn({ method: "GET" }).handler(() => editPageData());

export const Route = createFileRoute("/_protected/edit")({
  head: () => privatePageHead(),
  loader: () => getEdit(),
  component: EditPage,
  pendingComponent: EditLoading,
  errorComponent: ProtectedError,
});

function EditPage() {
  const content = Route.useLoaderData();

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-5xl mx-auto px-4 lg:px-6 space-y-6">
        <div className="mb-2">
          <h1 className="text-3xl font-bold text-foreground">Edit Resume</h1>
          <p className="text-muted-foreground mt-1">
            Update your resume content and publish changes
          </p>
        </div>
        <EditResumeFormWrapper initialData={content} />
      </div>
    </div>
  );
}

function EditLoading() {
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4 lg:px-6">
        <div className="mb-8">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-80" />
        </div>

        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <Skeleton className="h-6 w-40 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-18" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <Skeleton className="h-6 w-44 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-18" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-9 w-32 rounded-md" />
            </div>
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={`exp-skeleton-${i}`} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-36" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-16 w-full rounded-md" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-9 w-24 rounded-md" />
            </div>
            <div className="flex flex-wrap gap-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-20 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
