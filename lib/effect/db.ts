import { Context, Effect, Layer } from "effect";
import { getDb, type PgQueryable } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/pg-errors";
import { errorFields } from "@/lib/utils/error-fields";
import { classifyUpstreamCause, externalCall } from "./external";
import { DbConflict, DbFailed, type UpstreamDetails, type UpstreamKind } from "./failures";
import { TIMEOUT_MS } from "./timeouts";

// SQLSTATE classes (https://www.postgresql.org/docs/current/errcodes-appendix.html) that a
// later attempt can outlive: 08 connection, 40 rollback, 53 resources, 57 shutdown, 55P03 lock.
const TRANSIENT_SQLSTATE = /^(?:08|40|53|57)|^55P03$/;

// 22 data, 23 integrity, 42 syntax/access: the statement itself is wrong.
const REJECTED_SQLSTATE = /^(?:22|23|42)/;

export function classifyDbCause(cause: unknown): UpstreamKind {
  const sqlState = errorFields(cause)["error.code"];

  if (sqlState && TRANSIENT_SQLSTATE.test(sqlState)) return "unavailable";

  if (sqlState && REJECTED_SQLSTATE.test(sqlState)) return "rejected";

  return classifyUpstreamCause(cause);
}

function dbFailure(details: UpstreamDetails): DbFailed | DbConflict {
  if (details.cause instanceof Error && isUniqueViolation(details.cause)) {
    return new DbConflict({ message: details.message, cause: details.cause });
  }

  return new DbFailed(details);
}

type DbService = {
  /** One statement or a few reads. Operation labels are low-cardinality and PII-free. */
  readonly query: <A>(
    operation: string,
    run: (db: PgQueryable) => PromiseLike<A>,
  ) => Effect.Effect<A, DbFailed | DbConflict>;
  /** All writes in `run` commit together or not at all; keep the body to database calls. */
  readonly transaction: <A>(
    operation: string,
    run: (tx: PgQueryable) => Promise<A>,
  ) => Effect.Effect<A, DbFailed | DbConflict>;
};

function service(db: PgQueryable): DbService {
  return {
    query: (operation, run) =>
      externalCall({
        operation,
        timeoutMs: TIMEOUT_MS.db,
        run: () => run(db),
        fail: dbFailure,
        classify: classifyDbCause,
        span: false,
      }),
    transaction: (operation, run) =>
      externalCall({
        operation,
        timeoutMs: TIMEOUT_MS.dbTransaction,
        run: () => db.transaction((tx) => run(tx)),
        fail: dbFailure,
        classify: classifyDbCause,
        span: false,
      }),
  };
}

/**
 * Postgres through Hyperdrive. The layer opens a pool when an edge builds it, once per
 * invocation: provide it at the edge, never from module scope.
 */
export class Db extends Context.Service<Db, DbService>()("clickfolio/Db") {
  static layer(hyperdrive: Hyperdrive): Layer.Layer<Db> {
    return Layer.sync(Db, () => service(getDb(hyperdrive)));
  }

  /** For tests: any Drizzle handle, such as the in-process PGlite from `createTestDb()`. */
  static layerFrom(db: PgQueryable): Layer.Layer<Db> {
    return Layer.succeed(Db, service(db));
  }
}
