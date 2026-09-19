import { Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WaitingContent } from "./waiting-content";

export const dynamic = "force-dynamic";

export default async function WaitingPage({
  searchParams,
}: {
  searchParams: Promise<{ resume_id?: string }>;
}) {
  const { resume_id } = await searchParams;

  if (!resume_id) {
    redirect("/dashboard");
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="relative">
            <div className="absolute inset-0 animate-ping opacity-30 rounded-full bg-brand" />
            <Sparkles className="h-8 w-8 text-brand relative animate-pulse" />
          </div>
        </div>
      }
    >
      <WaitingContent />
    </Suspense>
  );
}
