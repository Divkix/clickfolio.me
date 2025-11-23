import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EditResumeFormWrapper } from "@/components/forms/EditResumeFormWrapper";
import type { ResumeContent } from "@/lib/types/database";

export default async function EditPage() {
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Fetch user's site data
  const { data: siteData, error } = await supabase
    .from("site_data")
    .select("id, content")
    .eq("user_id", user.id)
    .single();

  // If no site data exists, redirect to dashboard
  if (error || !siteData) {
    redirect("/dashboard");
  }

  // Type assertion for content (safe because we control the schema)
  const content = siteData.content as unknown as ResumeContent;

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4 lg:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Edit Resume</h1>
          <p className="text-slate-600 mt-2">
            Update your resume content and publish changes
          </p>
        </div>
        <EditResumeFormWrapper initialData={content} />
      </div>
    </div>
  );
}
