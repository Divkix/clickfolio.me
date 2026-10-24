import { Layer } from "effect";
import { Db } from "./db";
import { Clerk } from "./services/clerk";

export type AppServices = Db | Clerk;

/**
 * The services a request edge provides. Built once per invocation, so the Postgres pool and
 * Clerk's secret never outlive their request. Later services (R2, email, queues) join here.
 */
export function appLayer(env: CloudflareEnv): Layer.Layer<AppServices> {
  return Layer.mergeAll(Db.layer(env.HYPERDRIVE), Clerk.layer(env));
}
