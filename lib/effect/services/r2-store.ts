import { Context, Data, Effect, Layer } from "effect";
import { externalCall } from "../external";
import { R2Failed } from "../failures";
import { TIMEOUT_MS } from "../timeouts";

/** R2 `delete()` takes at most this many keys per call. */
export const R2_DELETE_BATCH_LIMIT = 1000;

const LIST_PAGE_SIZE = 1000;

/**
 * The bucket answered and the key is not there. Not an outage: R2Failed says R2 could not
 * be asked. Callers decide whether a missing object is a 404, a skipped step or a bug.
 */
export class R2ObjectMissing extends Data.TaggedError("R2ObjectMissing")<{
  readonly message: string;
}> {}

/** What `R2Failed` says when the deployment has no bucket bound: a fault no retry will heal. */
export const R2_BINDING_MISSING_MESSAGE = "R2 binding is not configured";

/** The slice of `R2Bucket` this service uses, so tests can fake it without building R2 objects. */
type R2BucketLike = {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  put(
    key: string,
    value: R2PutBody,
    options?: { httpMetadata?: R2HTTPMetadata; customMetadata?: Record<string, string> },
  ): Promise<{ size: number; etag: string }>;
  delete(keys: string | string[]): Promise<void>;
  head(key: string): Promise<{ size: number; etag: string } | null>;
  list(options: {
    prefix: string;
    limit: number;
    cursor?: string;
  }): Promise<
    { objects: { key: string }[] } & ({ truncated: true; cursor: string } | { truncated: false })
  >;
};

export type R2PutBody = ArrayBuffer | Uint8Array | ReadableStream | string;

export type R2PutOptions = {
  readonly contentType?: string;
  readonly customMetadata?: Record<string, string>;
};

export type R2ObjectInfo = { readonly size: number; readonly etag: string };

export type R2KeyPage = { readonly keys: readonly string[]; readonly cursor: string | undefined };

type R2StoreService = {
  /** The whole object. A missing key is `R2ObjectMissing`; an outage is `R2Failed`. */
  readonly get: (key: string) => Effect.Effect<Uint8Array, R2Failed | R2ObjectMissing>;
  /** Never retry a timed-out put: the write may still land. */
  readonly put: (
    key: string,
    body: R2PutBody,
    options?: R2PutOptions,
  ) => Effect.Effect<R2ObjectInfo, R2Failed>;
  /** No-op for a key that is already gone, so a repeated delete is harmless. */
  readonly delete: (key: string) => Effect.Effect<void, R2Failed>;
  /** Deletes in batches of {@link R2_DELETE_BATCH_LIMIT}; stops at the first failed batch. */
  readonly deleteMany: (keys: readonly string[]) => Effect.Effect<void, R2Failed>;
  readonly head: (key: string) => Effect.Effect<R2ObjectInfo, R2Failed | R2ObjectMissing>;
  /** One page of keys under `prefix`; pass the returned cursor for the next page. */
  readonly listPage: (prefix: string, cursor?: string) => Effect.Effect<R2KeyPage, R2Failed>;
  /** Every key under `prefix`, one timed call per page. */
  readonly listKeys: (prefix: string) => Effect.Effect<string[], R2Failed>;
  /** A one-key listing: succeeds when the bucket answers, whatever it holds. */
  readonly ping: () => Effect.Effect<void, R2Failed>;
};

function missing(operation: string): R2ObjectMissing {
  return new R2ObjectMissing({ message: `${operation}: object not found` });
}

function call<A>(
  operation: string,
  bucket: R2BucketLike | undefined,
  run: (bucket: R2BucketLike) => PromiseLike<A>,
): Effect.Effect<A, R2Failed> {
  if (!bucket) {
    return Effect.fail(
      new R2Failed({ operation, kind: "unavailable", message: R2_BINDING_MISSING_MESSAGE }),
    );
  }

  return externalCall({
    operation,
    timeoutMs: TIMEOUT_MS.r2,
    // The binding takes no AbortSignal: a timeout stops the wait, not the operation.
    run: () => run(bucket),
    fail: (details) => new R2Failed(details),
  });
}

function service(bucket: R2BucketLike | undefined): R2StoreService {
  const listPage: R2StoreService["listPage"] = (prefix, cursor) =>
    call("r2.list", bucket, async (b) => {
      const page = await b.list({ prefix, limit: LIST_PAGE_SIZE, cursor });

      return {
        keys: page.objects.map((object) => object.key),
        cursor: page.truncated ? page.cursor : undefined,
      };
    });

  return {
    get: (key) =>
      call("r2.get", bucket, async (b) => {
        const object = await b.get(key);

        return object ? new Uint8Array(await object.arrayBuffer()) : null;
      }).pipe(
        Effect.flatMap((bytes) => (bytes ? Effect.succeed(bytes) : Effect.fail(missing("r2.get")))),
      ),
    put: (key, body, options) =>
      call("r2.put", bucket, async (b) => {
        const stored = await b.put(key, body, {
          httpMetadata: options?.contentType ? { contentType: options.contentType } : undefined,
          customMetadata: options?.customMetadata,
        });

        return { size: stored.size, etag: stored.etag };
      }),
    delete: (key) => call("r2.delete", bucket, (b) => b.delete(key)),
    deleteMany: (keys) =>
      Effect.forEach(
        Array.from({ length: Math.ceil(keys.length / R2_DELETE_BATCH_LIMIT) }, (_, index) =>
          keys.slice(index * R2_DELETE_BATCH_LIMIT, (index + 1) * R2_DELETE_BATCH_LIMIT),
        ),
        (batch) => call("r2.delete_many", bucket, (b) => b.delete([...batch])),
        { discard: true },
      ),
    head: (key) =>
      call("r2.head", bucket, async (b) => {
        const object = await b.head(key);

        return object ? { size: object.size, etag: object.etag } : null;
      }).pipe(
        Effect.flatMap((info) => (info ? Effect.succeed(info) : Effect.fail(missing("r2.head")))),
      ),
    listPage,
    ping: () =>
      call("r2.ping", bucket, (b) => b.list({ prefix: "", limit: 1 })).pipe(Effect.asVoid),
    listKeys: (prefix) =>
      Effect.gen(function* () {
        const keys: string[] = [];
        let cursor: string | undefined;

        do {
          const page: R2KeyPage = yield* listPage(prefix, cursor);

          keys.push(...page.keys);
          cursor = page.cursor;
        } while (cursor);

        return keys;
      }),
  };
}

/**
 * The R2 bucket. Every call has a timeout and fails with `R2Failed`; a missing key is the
 * separate `R2ObjectMissing`. Provide it at the edge, never from module scope.
 */
export class R2Store extends Context.Service<R2Store, R2StoreService>()("clickfolio/R2Store") {
  /** A missing binding makes every call fail `unavailable` rather than crash at build time. */
  static layer(env: Partial<Pick<CloudflareEnv, "CLICKFOLIO_R2_BUCKET">>): Layer.Layer<R2Store> {
    return Layer.sync(R2Store, () => service(env.CLICKFOLIO_R2_BUCKET));
  }

  /** For tests: any object with the bucket methods. */
  static layerFrom(bucket: R2BucketLike): Layer.Layer<R2Store> {
    return Layer.succeed(R2Store, service(bucket));
  }
}
