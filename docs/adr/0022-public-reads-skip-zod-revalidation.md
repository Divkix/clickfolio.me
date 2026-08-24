# Public reads skip Zod re-validation of stored content

Public fetchers in `lib/data/resume.ts` only parse stored content JSON in a try/catch (→ null on failure), skipping Zod re-validation. The database (Postgres now, D1 before the cutover) is a trusted source; skipping redundant validation saves 200–400 ms per read. Post-cutover the `jsonb` columns are parsed by Drizzle automatically.
