import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

// `pnpm run verify` step: fails when AGENTS.md or CODING_STANDARDS.md names a repo path or a code
// identifier that no longer exists, so a rename breaks the gate instead of leaving the docs stale.
// Paths are relative Markdown link targets and code spans that start at a tracked top-level entry
// or end in `/` or a source-file extension; each must be a tracked file or directory, so a
// local-only file cannot pass here and fail in CI.
// Identifiers are the camelCase, PascalCase-with-a-hump and UPPER_CASE words inside other code
// spans; each must occur in some tracked non-Markdown file, so a doc cannot vouch for itself.

const ROOT = join(import.meta.dirname, "..");
const DOCS = ["AGENTS.md", "CODING_STANDARDS.md"];

// Written by @tanstack/intent; it names files inside installed packages.
const GENERATED_BLOCK = /<!-- intent-skills:start -->[\s\S]*?<!-- intent-skills:end -->/g;
const CODE_SPAN = /`([^`\n]+)`/g;
const LINK_TARGET = /\]\(([^)\s]+)\)/g;
const URL_SCHEME = /^[a-z][a-z+.-]*:/i;
const WORD = /[A-Za-z_$][\w$]*/g;
const NOT_A_PATH = /[\s<>*:{}()$]/;
const PATH_SUFFIX = /(\/|[^/]\.([cm]?[jt]sx?|jsonc?|ya?ml|toml|sql|css|md))$/;
const BINARY_FILE = /\.(webp|png|jpe?g|gif|ico|pdf|woff2?|ttf|otf)$/;

// Library and tool names the docs mention that no tracked file contains.
const EXTERNAL_NAMES = new Set(["ERR_PNPM_OUTDATED_LOCKFILE", "ManagedRuntime"]);

interface Tracked {
  paths: Set<string>;
  words: Set<string>;
}

function isCodeIdentifier(word: string): boolean {
  return word.includes("_") || /[a-z0-9][A-Z]/.test(word) || /^[A-Z]{2,}$/.test(word);
}

function isRepoPath(span: string, paths: Set<string>): boolean {
  if (NOT_A_PATH.test(span) || span.startsWith("/") || span.startsWith("@")) return false;

  return paths.has(span.split("/")[0] ?? "") || PATH_SUFFIX.test(span);
}

function trackedFiles(): Tracked {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split(
    "\0",
  );

  const paths = new Set<string>();
  const words = new Set<string>();

  for (const file of files) {
    const path = join(ROOT, file);

    if (!file || !existsSync(path)) continue;

    for (let slash = file.indexOf("/"); slash !== -1; slash = file.indexOf("/", slash + 1)) {
      paths.add(file.slice(0, slash));
    }

    paths.add(file);

    if (file.endsWith(".md") || BINARY_FILE.test(file)) continue;

    for (const [word] of readFileSync(path, "utf8").matchAll(WORD)) words.add(word);
  }

  return { paths, words };
}

function staleReferences(doc: string, { paths, words }: Tracked): string[] {
  const text = readFileSync(join(ROOT, doc), "utf8").replace(GENERATED_BLOCK, "");
  const stale: string[] = [];

  for (const [, target = ""] of text.matchAll(LINK_TARGET)) {
    const path = target.split("#")[0] ?? "";

    if (!path || URL_SCHEME.test(path)) continue;

    if (!paths.has(posix.normalize(path).replace(/\/$/, ""))) {
      stale.push(`${doc}: broken link \`${target}\``);
    }
  }

  for (const [, span = ""] of text.matchAll(CODE_SPAN)) {
    if (isRepoPath(span, paths)) {
      if (!paths.has(span.replace(/\/$/, ""))) stale.push(`${doc}: no such path \`${span}\``);

      continue;
    }

    for (const [word] of span.matchAll(WORD)) {
      if (isCodeIdentifier(word) && !words.has(word) && !EXTERNAL_NAMES.has(word)) {
        stale.push(`${doc}: \`${word}\` appears in no tracked file`);
      }
    }
  }

  return stale;
}

const tracked = trackedFiles();
const stale = DOCS.flatMap((doc) => staleReferences(doc, tracked));

if (stale.length > 0) {
  console.error(
    `${stale.join("\n")}\nFix the doc, or add a library/tool name to EXTERNAL_NAMES in ${import.meta.filename}.`,
  );
  process.exit(1);
}
