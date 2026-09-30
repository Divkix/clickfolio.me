import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createMockDb, createMockQueryChain } from "../../setup/mocks/db.mock";

const mockDb = createMockDb();

vi.mock("cloudflare:workers", () => ({ env: { HYPERDRIVE: {} } }));

vi.mock("@/lib/db", () => ({ getDb: () => mockDb }));

vi.mock("@/lib/auth/with-auth", () => ({
  withAdmin: (_request: Request, handler: () => Promise<Response>) => handler(),
}));

describe("GET /api/admin/resumes ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sorts by COALESCE(updated_at, created_at) so never-updated rows are not buried", async () => {
    const listChain = createMockQueryChain([]);

    // Call order in the route: status counts, total count, resume list.
    mockDb.select
      .mockReturnValueOnce(createMockQueryChain([]))
      .mockReturnValueOnce(createMockQueryChain([{ count: 0 }]))
      .mockReturnValueOnce(listChain);

    const { GET } = await import("@/app/api/admin/resumes/route");
    const response = await GET(new Request("http://localhost:3000/api/admin/resumes"));

    expect(response.status).toBe(200);

    // SAFETY: the route passes a single drizzle `sql` template to orderBy.
    const orderArg = listChain.orderBy.mock.calls[0]?.[0] as SQL;
    const { sql: rendered } = new PgDialect().sqlToQuery(orderArg);

    expect(rendered).toBe('COALESCE("resumes"."updated_at", "resumes"."created_at") DESC');
    expect(rendered).not.toContain("NULLS LAST");
  });
});
