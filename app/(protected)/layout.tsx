import { env } from "cloudflare:workers";
import { Effect } from "effect";
import type { Metadata } from "next";
import { findSession } from "@/lib/auth/session";
import { runPage } from "@/lib/effect/edges";
import { appLayer } from "@/lib/effect/layers";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";
import { SidebarLayoutClient } from "./SidebarLayoutClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await runPage(
    findSession().pipe(
      Effect.catch((error) =>
        Effect.sync(() => {
          log("error", "Unable to load sidebar profile", { ...errorFields(error) });

          return null;
        }),
      ),
    ),
    appLayer(env),
  );

  return (
    <SidebarLayoutClient
      handle={session?.user.handle ?? null}
      isAdmin={session?.user.isAdmin ?? false}
    >
      {children}
    </SidebarLayoutClient>
  );
}
