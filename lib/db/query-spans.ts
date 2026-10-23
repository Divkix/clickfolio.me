import type { PoolClient, QueryConfig, QueryResult } from "pg";
import { type SpanAttributes, startSpan } from "../telemetry/spans";

// Hyperdrive and Postgres get no automatic spans, so each statement gets one.

const OPERATION = /^\s*([a-z]+)/i;

// Drizzle double-quotes identifiers and binds every value as `$n`, so a quoted
// word after one of these keywords is a table name, never data.
const TABLE = /\b(?:from|into|update|join)\s+"(\w+)"/i;

type Statement = { name: string; attributes: SpanAttributes };

/** Span name and attributes from the statement's operation and first table only. */
export function describeStatement(text: string): Statement {
  const operation = OPERATION.exec(text)?.[1]?.toUpperCase();
  const table = TABLE.exec(text)?.[1];
  // OTel database span naming: "{operation} {table}", else the operation, else the system.
  const summary = [operation, table].filter(Boolean).join(" ") || "postgresql";

  return {
    name: summary,
    attributes: {
      "db.system.name": "postgresql",
      "db.operation.name": operation,
      "db.collection.name": table,
      "db.query.summary": summary,
    },
  };
}

type QueryCallback = (cause: Error | null, result: QueryResult) => void;

type Values = QueryConfig["values"];

// The two call shapes that reach a pooled client: pg-pool's `pool.query`
// (text or config, optional values, callback) and Drizzle's transactions (config, promise).
type CallbackQuery = (
  statement: string | QueryConfig,
  values: Values | QueryCallback,
  callback?: QueryCallback,
) => void;

type PromiseQuery = (statement: string | QueryConfig, values?: Values) => Promise<QueryResult>;

/**
 * Wraps a pooled client's `query` in a span. Pool queries (callback form) and
 * transaction statements (promise form) both run through a client's `query`.
 */
export function traceQueries(client: Pick<PoolClient, "query">): void {
  // SAFETY: pg's overloads include both shapes; arguments pass through unchanged.
  const withCallback = client.query.bind(client) as CallbackQuery;
  // SAFETY: as above; without a callback pg returns a promise.
  const withPromise = client.query.bind(client) as PromiseQuery;

  function traced(
    statement: string | QueryConfig,
    values?: Values | QueryCallback,
    callback?: QueryCallback,
  ): Promise<QueryResult> | void {
    const text = statement instanceof Object ? statement.text : statement;
    const { name, attributes } = describeStatement(text);
    const span = startSpan(name, attributes);

    const ending =
      (done: QueryCallback): QueryCallback =>
      (cause, result) => {
        span.end(cause);
        done(cause, result);
      };

    try {
      if (values instanceof Function) return withCallback(statement, ending(values));

      if (callback) return withCallback(statement, values, ending(callback));

      return withPromise(statement, values).then(
        (result) => {
          span.end();

          return result;
        },
        (cause: Error) => {
          span.end(cause);
          throw cause;
        },
      );
    } catch (cause) {
      // pg throws synchronously for an invalid statement.
      span.end(cause);
      throw cause;
    }
  }

  // SAFETY: `traced` keeps the original's arguments and results for both shapes it handles.
  client.query = traced as PoolClient["query"];
}
