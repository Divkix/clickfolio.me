import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { z } from "zod";
import { WaitingContent } from "@/components/dashboard/WaitingContent";
import { ProtectedError } from "@/components/errors/ProtectedError";
import { waitingPageData } from "@/lib/data/owner-pages";

const waitingSearch = z.object({ resume_id: z.string().optional() });

const loadWaiting = createServerFn({ method: "GET" })
  .validator(waitingSearch)
  .handler(({ data }) => waitingPageData(data.resume_id));

export const Route = createFileRoute("/_protected/waiting")({
  validateSearch: waitingSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadWaiting({ data: deps }),
  errorComponent: ProtectedError,
  pendingComponent: WaitingPending,
  component: WaitingPage,
});

function WaitingPage() {
  const { resumeId } = Route.useLoaderData();

  return <WaitingContent resumeId={resumeId} />;
}

function WaitingPending() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="relative">
        <div className="absolute inset-0 animate-ping opacity-30 rounded-full bg-brand" />
        <Sparkles className="h-8 w-8 text-brand relative animate-pulse" />
      </div>
    </div>
  );
}
