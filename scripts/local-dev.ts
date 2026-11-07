import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { constants } from "node:os";
import { setTimeout } from "node:timers/promises";
import { parseEnv } from "node:util";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { siteDataContentColumns } from "@/lib/data/site-data-content";
import { siteData, user } from "@/lib/db/schema";
import { DEMO_RESUME_CONTENT } from "@/lib/templates/demo-data";
import { DEMO_PROFILES } from "@/lib/templates/demo-profiles";
import { extractPreviewFields } from "@/lib/utils/preview-fields";

const databaseUrl = "postgresql://postgres:postgres@localhost:5432/clickfolio";
const adminUrl = new URL("/postgres", databaseUrl).href;

const env: NodeJS.ProcessEnv = {
  ...process.env,
  // A terminal may carry another app's Clerk keys; this repo's .env must win before local pins.
  ...parseEnv(existsSync(".env") ? readFileSync(".env", "utf8") : ""),
  DATABASE_URL: databaseUrl,
  LOCAL_DATABASE_URL: databaseUrl,
  APP_URL: "http://localhost:3000",
  NODE_ENV: "development",
};

// CI=true makes Alchemy ignore ~/.alchemy's saved login and fail with CredentialsUnavailable.
delete env.CI;
// Alchemy reads process env before .env, so these pinned URLs also control the Hyperdrive binding.

function run(command: string, args: string[]): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const child = spawn(command, args, { env, stdio: "inherit", detached: true });

  const forward = (signal: NodeJS.Signals) => {
    if (child.pid) process.kill(-child.pid, signal);
  };

  const interrupt = () => forward("SIGINT");
  const terminate = () => forward("SIGTERM");

  const cleanup = () => {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  };

  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  child.once("error", (error) => {
    cleanup();
    reject(error);
  });
  child.once("exit", (code, signal) => {
    cleanup();

    if (signal) process.exit(128 + constants.signals[signal]);

    if (code !== 0) process.exit(code ?? 1);

    resolve();
  });

  return promise;
}

async function ensurePostgres(): Promise<void> {
  if (spawnSync("docker", ["info"], { stdio: "ignore" }).status !== 0) {
    throw new Error(
      "Docker isn't running: start OrbStack or Docker Desktop, then rerun pnpm run local-dev.",
    );
  }

  let container = spawnSync(
    "docker",
    ["container", "inspect", "local-postgres", "--format", "{{.State.Running}}"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );

  if (container.status !== 0) {
    const created = spawnSync(
      "docker",
      [
        "run",
        "--detach",
        "--name",
        "local-postgres",
        "-e",
        "POSTGRES_PASSWORD=postgres",
        "-p",
        "127.0.0.1:5432:5432",
        "-v",
        "local-postgres:/var/lib/postgresql",
        "postgres:18",
      ],
      { encoding: "utf8" },
    );

    container = spawnSync(
      "docker",
      ["container", "inspect", "local-postgres", "--format", "{{.State.Running}}"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );

    // Another app's launcher may have claimed the shared container name in the meantime.
    if (created.status !== 0 && container.status !== 0) {
      throw new Error(created.stderr || "Could not create local-postgres.");
    }
  }

  if (container.stdout.trim() !== "true") await run("docker", ["start", "local-postgres"]);

  const deadline = Date.now() + 60_000;

  while (
    spawnSync("docker", ["exec", "local-postgres", "pg_isready", "-U", "postgres"], {
      stdio: "ignore",
    }).status !== 0
  ) {
    if (Date.now() >= deadline) throw new Error("local-postgres did not become ready within 60s.");

    await setTimeout(500);
  }
}

async function ensureDatabase(): Promise<void> {
  const client = new Client({ connectionString: adminUrl });

  try {
    await client.connect();

    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      "clickfolio",
    ]);

    if (existing.rowCount === 0) await client.query("CREATE DATABASE clickfolio");
  } finally {
    await client.end();
  }
}

async function seed(): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    const db = drizzle(client);
    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      for (const profile of DEMO_PROFILES) {
        const id = `user_seed_${profile.id}`;
        const handle = `demo-${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        const email = `seed-${profile.id}@example.com`;
        const demo = DEMO_RESUME_CONTENT[profile.id];
        const content = { ...demo, contact: { ...demo.contact, email } };

        await tx
          .insert(user)
          .values({
            id,
            name: profile.name,
            email,
            emailVerified: true,
            handle,
            headline: demo.headline,
            onboardingCompleted: true,
            showInDirectory: true,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing();
        await tx
          .insert(siteData)
          .values({
            id: `site_seed_${profile.id}`,
            userId: id,
            ...siteDataContentColumns(content),
            ...extractPreviewFields(content),
            themeId: profile.id,
            lastPublishedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing();
      }
    });
    console.log(
      `[local-dev] Demo portfolios ready (${DEMO_PROFILES.length} fixtures; local edits kept).`,
    );
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  for (const connection of [databaseUrl, adminUrl]) {
    if (!["localhost", "127.0.0.1"].includes(new URL(connection).hostname)) {
      throw new Error("Refusing to migrate or seed a non-local database.");
    }
  }

  await ensurePostgres();
  await ensureDatabase();
  await run("pnpm", ["run", "db:migrate"]);
  await seed();
  await run("pnpm", ["run", "dev"]);
}

main().catch((error: Error) => {
  console.error(`[local-dev] ${error.message}`);
  process.exitCode = 1;
});
