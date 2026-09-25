// Language colours follow GitHub Linguist so the dots read like a repository's language bar.
// Keys are matched exactly after normalising, so "Go" never colours "Google", "MongoDB" or "Django".
const TECH_COLORS = new Map(
  Object.entries({
    typescript: "#3178c6",
    ts: "#3178c6",
    javascript: "#f1e05a",
    js: "#f1e05a",
    python: "#3572a5",
    go: "#00add8",
    golang: "#00add8",
    rust: "#dea584",
    java: "#b07219",
    kotlin: "#a97bff",
    swift: "#f05138",
    c: "#555555",
    "c++": "#f34b7d",
    cpp: "#f34b7d",
    "c#": "#178600",
    ruby: "#701516",
    php: "#4f5d95",
    elixir: "#6e4a7e",
    scala: "#c22d40",
    haskell: "#5e5086",
    dart: "#00b4ab",
    lua: "#000080",
    zig: "#ec915c",
    html: "#e34c26",
    css: "#663399",
    shell: "#89e051",
    bash: "#89e051",
    sql: "#e38c00",
    webassembly: "#654ff0",
    wasm: "#654ff0",
    react: "#61dafb",
    "next.js": "#e6edf3",
    nextjs: "#e6edf3",
    "node.js": "#5fa04e",
    nodejs: "#5fa04e",
    node: "#5fa04e",
    vite: "#646cff",
    postgresql: "#4169e1",
    postgres: "#4169e1",
    mongodb: "#47a248",
    redis: "#dc382d",
    docker: "#2496ed",
    kubernetes: "#326ce5",
    git: "#f05032",
    linux: "#fcc624",
    cloudflare: "#f38020",
  }),
);

const FALLBACK_COLOR = "#768390";

export function techDotColor(tech: string): string {
  return TECH_COLORS.get(tech.trim().toLowerCase()) ?? FALLBACK_COLOR;
}
