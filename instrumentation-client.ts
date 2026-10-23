// Relative imports: instrumentation-client runs as a root entry; keep deps local.
import { initBrowserTelemetry } from "./lib/telemetry/browser";
import { installStaleChunkReload } from "./lib/utils/chunk-reload";

installStaleChunkReload();

initBrowserTelemetry();
