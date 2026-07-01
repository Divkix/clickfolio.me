# Public reads skip Zod re-validation of D1 content

Public fetchers in `lib/data/resume.ts` only `JSON.parse` D1 content JSON in a try/catch (→ null on failure), skipping Zod re-validation. D1 is a trusted source; skipping redundant validation saves 200–400 ms per read.
