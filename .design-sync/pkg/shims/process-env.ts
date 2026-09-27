// Design-sync shim: Vite inlines process.env.* in the app; the browser bundle has no `process`.
const g = globalThis as { process?: { env: Record<string, string | undefined> } };
g.process ??= { env: {} };
