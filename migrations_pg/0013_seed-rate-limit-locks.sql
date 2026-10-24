-- Fixed rows for the per-IP metering lock: a transaction runs
-- `SELECT ... WHERE slot = abs(hashtext(key)::bigint) % 256 FOR UPDATE` before it counts and
-- inserts, so concurrent requests in one bucket queue up instead of reading the same count.
-- Slots are shared by hashing, never written at runtime, and cost nothing when idle.
-- RATE_LIMIT_LOCK_SLOTS in lib/rate-limit/ip.ts must stay equal to the number of rows below.
INSERT INTO "rate_limit_locks" ("slot")
SELECT generate_series(0, 255);
