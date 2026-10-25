import { useEffect } from "react";
import { useSession } from "@/lib/auth/client";
import { setTelemetryUser } from "@/lib/telemetry/browser";

/** Tags browser telemetry with the signed-in user's app id; cleared on sign-out. */
export function TelemetryIdentity() {
  const { data, isPending } = useSession();
  const userId = data?.user.id ?? null;

  useEffect(() => {
    if (!isPending) setTelemetryUser(userId);
  }, [isPending, userId]);

  return null;
}
