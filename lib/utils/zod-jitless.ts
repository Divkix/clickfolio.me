import { config } from "zod/v4/core";

// The CSP allows no JS eval, so Zod's JIT can never run in the browser. Turning it off skips the
// `new Function("")` probe the CSP reports as a violation. Object schemas read the flag when they
// are built, so app/client.tsx imports this module first.
config({ jitless: true });
