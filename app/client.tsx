import "@/lib/utils/zod-jitless";
import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { initBrowserTelemetry } from "@/lib/telemetry/browser";
import { installStaleChunkReload } from "@/lib/utils/chunk-reload";

installStaleChunkReload();

initBrowserTelemetry();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
