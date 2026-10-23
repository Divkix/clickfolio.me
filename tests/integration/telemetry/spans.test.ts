import type { PoolClient, QueryResult } from "pg";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { SpanAttributes } from "@/lib/telemetry/spans";
import type { ResumeParseWorkflowBinding } from "@/lib/workflows/resume-parse";

type SpanException = Parameters<Span["recordException"]>[0];

type RecordedSpan = {
  name: string;
  attributes: SpanAttributes;
  exceptions: SpanException[];
  ended: boolean;
};

const recorded = vi.hoisted((): RecordedSpan[] => []);

vi.mock("cloudflare:workers", () => {
  function span(name: string) {
    const entry: RecordedSpan = { name, attributes: {}, exceptions: [], ended: false };
    recorded.push(entry);

    const handle = {
      isTraced: true,
      setAttributes(attributes: SpanAttributes) {
        for (const [key, value] of Object.entries(attributes)) {
          if (value !== undefined) entry.attributes[key] = value;
        }

        return handle;
      },
      recordException(exception: SpanException) {
        entry.exceptions.push(exception);
      },
      end() {
        entry.ended = true;
      },
    };

    return handle;
  }

  return {
    tracing: {
      enterSpan: async <T>(name: string, run: (handle: ReturnType<typeof span>) => Promise<T>) => {
        const handle = span(name);

        try {
          return await run(handle);
        } finally {
          handle.end();
        }
      },
      startSpan: span,
      getActiveSpan: () => span("root"),
    },
  };
});

const { annotateActiveSpan, withSpan } = await import("@/lib/telemetry/spans");

const { startResumeParse } = await import("@/lib/workflows/resume-parse");

const { describeStatement, traceQueries } = await import("@/lib/db/query-spans");

const RESULT: QueryResult = { rows: [], rowCount: 0, command: "SELECT", oid: 0, fields: [] };

beforeEach(() => {
  recorded.length = 0;
});

describe("withSpan", () => {
  it("sets attributes up front and once known", async () => {
    await withSpan("chat model", { "gen_ai.request.model": "model" }, async (annotate) => {
      annotate({ "gen_ai.usage.input_tokens": 12, "gen_ai.usage.output_tokens": undefined });
    });

    expect(recorded).toEqual([
      {
        name: "chat model",
        attributes: { "gen_ai.request.model": "model", "gen_ai.usage.input_tokens": 12 },
        exceptions: [],
        ended: true,
      },
    ]);
  });

  it("records a thrown error as scrubbed fields and rethrows it", async () => {
    const failure = new TypeError("no profile for jane@example.com");

    await expect(
      withSpan("step", {}, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(recorded[0].exceptions).toEqual([
      expect.objectContaining({ name: "TypeError", message: "no profile for [email]" }),
    ]);
  });
});

describe("trace linking", () => {
  it("tags the workflow.create span with the ids the run's step spans repeat", async () => {
    const create = vi.fn<ResumeParseWorkflowBinding["create"]>();

    const workflow: Pick<ResumeParseWorkflowBinding, "create" | "get"> = {
      create,
      get: vi.fn(),
    };

    await startResumeParse(workflow, "resume-1", { kind: "await-cache", resumeId: "resume-1" });

    expect(create).toHaveBeenCalledOnce();
    expect(recorded).toEqual([
      {
        name: "workflow.create clickfolio-resume-parse",
        attributes: {
          "workflow.name": "clickfolio-resume-parse",
          "workflow.instance_id": "resume-1",
          "workflow.params.kind": "await-cache",
          "resume.id": "resume-1",
        },
        exceptions: [],
        ended: true,
      },
    ]);
  });

  it("annotates the span already active", () => {
    annotateActiveSpan({ "status_do.operation": "notify" });

    expect(recorded).toMatchObject([
      { name: "root", attributes: { "status_do.operation": "notify" } },
    ]);
  });
});

describe("describeStatement", () => {
  it.each([
    ['select "id", "status" from "resumes" where "resumes"."id" = $1', "SELECT resumes"],
    ['insert into "site_data" ("user_id") values ($1) on conflict do nothing', "INSERT site_data"],
    ['update "resumes" set "status" = $1 from "users" where "users"."id" = $2', "UPDATE resumes"],
    ['delete from "handles" where "handles"."user_id" = $1', "DELETE handles"],
    ["begin", "BEGIN"],
    ["", "postgresql"],
  ])("names %j as %j", (text, name) => {
    expect(describeStatement(text).name).toBe(name);
  });

  it("never reads unquoted words or literals as a table", () => {
    const { attributes } = describeStatement(
      "select * from pg_stat_activity where usename = 'jane'",
    );

    expect(attributes).toMatchObject({ "db.operation.name": "SELECT" });
    expect(attributes["db.collection.name"]).toBeUndefined();
  });
});

describe("traceQueries", () => {
  function fakeClient(outcome: Error | null) {
    const query = vi.fn((...args: unknown[]) => {
      const callback = args.findLast((arg) => arg instanceof Function);

      if (callback instanceof Function) {
        queueMicrotask(() => callback(outcome, RESULT));

        return undefined;
      }

      return outcome ? Promise.reject(outcome) : Promise.resolve(RESULT);
    });

    // SAFETY: the fake implements the callback and promise shapes traceQueries handles.
    const client: Pick<PoolClient, "query"> = { query: query as PoolClient["query"] };
    traceQueries(client);

    return { client, query };
  }

  it("spans pool queries (callback form) without the bound values", async () => {
    const { client, query } = fakeClient(null);
    const text = 'select "id" from "resumes" where "resumes"."user_id" = $1';

    const result = await new Promise((resolve) => {
      client.query(text, ["user_secret"], (_error, value) => resolve(value));
    });

    expect(result).toBe(RESULT);
    expect(query).toHaveBeenCalledWith(text, ["user_secret"], expect.any(Function));
    expect(recorded).toEqual([
      {
        name: "SELECT resumes",
        attributes: {
          "db.system.name": "postgresql",
          "db.operation.name": "SELECT",
          "db.collection.name": "resumes",
          "db.query.summary": "SELECT resumes",
        },
        exceptions: [],
        ended: true,
      },
    ]);
  });

  it("spans transaction statements (promise form) and records failures", async () => {
    const failure = new Error('duplicate key value violates unique constraint "handles_pkey"');
    const { client } = fakeClient(failure);

    await expect(
      client.query({ text: 'insert into "handles" ("handle") values ($1)', values: ["jane"] }),
    ).rejects.toBe(failure);

    expect(recorded).toMatchObject([
      {
        name: "INSERT handles",
        ended: true,
        exceptions: [expect.objectContaining({ name: "Error" })],
      },
    ]);
    expect(JSON.stringify(recorded)).not.toContain("jane");
  });
});

describe("traceQueries on a synchronous throw", () => {
  it("ends the span and rethrows", () => {
    const failure = new TypeError("Client was passed a null or undefined query");

    // SAFETY: a fake that throws like pg does for an invalid statement.
    const query = vi.fn(() => {
      throw failure;
    }) as PoolClient["query"];

    const client: Pick<PoolClient, "query"> = { query };
    traceQueries(client);

    expect(() => client.query("")).toThrow(failure);
    expect(recorded).toMatchObject([
      { name: "postgresql", ended: true, exceptions: [{ name: "TypeError" }] },
    ]);
  });
});

describe("without the tracing API", () => {
  it("still runs the wrapped work", async () => {
    vi.resetModules();
    vi.doMock("cloudflare:workers", () => ({ env: {} }));
    const fresh = await import("@/lib/telemetry/spans");

    await expect(fresh.withSpan("step", {}, async () => "done")).resolves.toBe("done");
    expect(() => fresh.startSpan("q", {}).end(new Error("x"))).not.toThrow();
    expect(recorded).toEqual([]);
    vi.doUnmock("cloudflare:workers");
  });
});
