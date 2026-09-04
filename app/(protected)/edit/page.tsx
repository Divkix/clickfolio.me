import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EditResumeFormWrapper } from "@/components/forms/EditResumeFormWrapper";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { siteData } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function EditPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/");
  }

  const db = getDb(env.HYPERDRIVE);

  const siteDataResult = await db.query.siteData.findFirst({
    where: eq(siteData.userId, session.user.id),
  });

  if (!siteDataResult) {
    redirect("/dashboard");
  }

  const content = siteDataResult.content;

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
