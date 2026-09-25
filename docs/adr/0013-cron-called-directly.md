# Cron triggers called directly in worker/index.ts (not HTTP self-fetch)

Cron triggers (now just `0 3 * * *`) are invoked directly from `scheduled()` in `worker/index.ts`, not via an HTTP self-fetch. This avoids double-billing the Worker for each scheduled run.
