// Compiles .design-sync/tailwind.css -> .design-sync/pkg/dist/ds.css with the repo's
// own @tailwindcss/postcss (Tailwind 4). Run from the repo root: node .design-sync/build-css.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, "tailwind.css");
const to = join(here, "pkg", "dist", "ds.css");
const result = await postcss([tailwind({ base: join(here, ".."), optimize: { minify: true } })]).process(readFileSync(from, "utf8"), { from, to });
mkdirSync(dirname(to), { recursive: true });
writeFileSync(to, result.css);
console.log(`ds.css: ${(result.css.length / 1024).toFixed(0)} KB`);
