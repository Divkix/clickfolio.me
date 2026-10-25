import { serverHandler } from "@/tests/helpers/server-route";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { siteData, user } from "@/lib/db/schema";
import { createTestDb, INDEXABLE_CONTENT, type TestDb } from "@/tests/helpers/pglite-db";

interface Holder {
  db: TestDb | null;
  svgs: string[];
}

const holder = vi.hoisted(() => {
  const value: Holder = { db: null, svgs: [] };

  return value;
});

vi.mock("cloudflare:workers", () => ({
  env: { HYPERDRIVE: { connectionString: "postgres://unused" } },
}));

vi.mock("@/lib/db", () => ({ getDb: () => holder.db }));

vi.mock("@cf-wasm/resvg/workerd", () => ({
  Resvg: {
    async: async (svg: string) => {
      holder.svgs.push(svg);

      return { render: () => ({ asPng: () => new Uint8Array([137, 80, 78, 71]) }) };
    },
  },
}));

const GET = serverHandler((await import("@/app/routes/api/og/$handle")).Route, "GET");

const NOW = "2026-01-01T00:00:00.000Z";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  testDb = await createTestDb();
  holder.db = testDb.db;
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  holder.svgs.length = 0;
});

function ask(handle: string) {
  return GET(new Request(`https://clickfolio.me/api/og/${handle}`), { handle });
}

describe("GET /api/og/[handle] only describes published portfolios", () => {
  it("does not draw the account name of a user whose portfolio is gone", async () => {
    // /@handle answers 404 for a user without a site_data row (e.g. after the resume was deleted).
    await testDb.db.insert(user).values({
      id: "user_gone",
      name: "Private Person",
      email: "gone@example.com",
      handle: "gone",
      createdAt: NOW,
      updatedAt: NOW,
    });

    const response = await ask("gone");
    const rendered = holder.svgs.join("");

    expect(rendered).not.toContain("Private Person");
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
  });

  it("still draws a published portfolio", async () => {
    await testDb.db.insert(user).values({
      id: "user_live",
      name: "Live Person",
      email: "live@example.com",
      handle: "live",
      createdAt: NOW,
      updatedAt: NOW,
    });

    await testDb.db.insert(siteData).values({
      id: "site_live",
      userId: "user_live",
      content: INDEXABLE_CONTENT,
      previewName: "Live Person",
      createdAt: NOW,
      updatedAt: NOW,
    });

    const response = await ask("live");

    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(holder.svgs.join("")).toContain("Live Person");
  });
});
