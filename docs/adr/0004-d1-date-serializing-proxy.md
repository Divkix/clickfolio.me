> **SUPERSEDED by [0024](0024-planet-scale-postgres-clerk-cutover.md)** — D1 (and the
> proxy) was removed in the PlanetScale Postgres cutover; timestamps are native
> `timestamptz` now. Kept for historical context.

# D1 binding wrapped in a date-serializing Proxy

The D1 binding is wrapped in a `Proxy` (`wrapD1WithDateSerialization` in `lib/auth/index.ts`, cached in the `d1ProxyCache` WeakMap) that converts `Date` → ISO string on `.bind()`. Better Auth's drizzle-adapter accepts `supportsDates:false` but never forwards it, and D1 can't `.bind()` `Date` objects. This is also why ALL timestamp columns are stored as `text` (ISO strings).
