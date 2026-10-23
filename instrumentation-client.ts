// Relative import: instrumentation-client runs as a root entry; keep deps local.
import { installStaleChunkReload } from "./lib/utils/chunk-reload";

installStaleChunkReload();
