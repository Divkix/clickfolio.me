import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarLayoutClient } from "./SidebarLayoutClient";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/");
  }

  return <SidebarLayoutClient>{children}</SidebarLayoutClient>;
}
