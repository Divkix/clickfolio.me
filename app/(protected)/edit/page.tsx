import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { EditResumeFormWrapper } from "@/components/forms/EditResumeFormWrapper";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { siteData } from "@/lib/db/schema";
import type { ResumeContent } from "@/lib/types/database";

export default async function EditPage() {
  // Use cached session helper to deduplicate auth calls within request
  const session = await getServerSession();

  if (!session) {
    redirect("/");
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  // Fetch user's site data
  const siteDataResult = await db.query.siteData.findFirst({
    where: eq(siteData.userId, session.user.id),
  });

  // If no site data exists, redirect to dashboard
  if (!siteDataResult) {
    redirect("/dashboard");
  }

  // Parse content JSON (stored as text in D1)
  let content: ResumeContent;
  try {
    content = JSON.parse(siteDataResult.content) as ResumeContent;
  } catch (error) {
    console.error("Failed to parse siteData content:", error);
    redirect("/dashboard?error=corrupt_data");
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-5xl mx-auto px-4 lg:px-6 space-y-6">
        {/* Page Header */}
        <div className="mb-2">
          <h1 className="text-3xl font-bold text-slate-900">Edit Resume</h1>
          <p className="text-slate-600 mt-1">Update your resume content and publish changes</p>
        </div>
        <EditResumeFormWrapper initialData={content} />
      </div>
    </div>
  );
}
