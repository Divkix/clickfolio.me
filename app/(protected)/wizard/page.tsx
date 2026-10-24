import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import WizardClient from "@/components/wizard/WizardClient";
import { getServerSession } from "@/lib/auth/session";
import { loadWizardPage } from "@/lib/data/wizard-page";
import { Db } from "@/lib/effect/db";
import { runPage } from "@/lib/effect/edges";

export default async function WizardPage() {
  const session = await getServerSession();

  if (!session) redirect("/");

  const initialStart = await runPage(loadWizardPage(session.user.id), Db.layer(env.HYPERDRIVE));

  if (initialStart.kind === "redirect-waiting") {
    redirect(`/waiting?resume_id=${initialStart.resumeId}`);
  }

  return <WizardClient initialStart={initialStart} ownerHandle={session.user.handle} />;
}
