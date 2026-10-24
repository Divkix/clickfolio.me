import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EditResumeFormWrapper } from "@/components/forms/EditResumeFormWrapper";
import { getServerSession } from "@/lib/auth/session";
import { loadEditContent } from "@/lib/data/owner-pages";
import { Db } from "@/lib/effect/db";
import { runPage } from "@/lib/effect/edges";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function EditPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/");
  }

  const content = await runPage(loadEditContent(session.user.id), Db.layer(env.HYPERDRIVE));

  if (!content) {
    redirect("/dashboard");
  }

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
