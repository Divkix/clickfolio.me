-- Convergence for the claim-arbitration unique index: at most one pending_claim
-- resume per (user_id, file_hash). Databases that already recorded 0005 with the
-- earlier broad predicate (every non-terminal status) carry
-- resumes_user_hash_inflight_uidx with that broad shape; this file replaces it
-- with resumes_user_hash_pending_uidx, whose predicate is
-- "file_hash" IS NOT NULL AND "status" = 'pending_claim'.
--
-- Only pending_claim is arbitrated because queued/processing/waiting_for_cache
-- rows must coexist: a duplicate claim inserts a waiting_for_cache clone while
-- the first row is queued/processing, and retry/orphan requeues flip rows back
-- to queued while a same-hash row is still in flight. The per-user transaction
-- lock in claim-intake closes the flip race. No backfill.
--
-- Hand-written (like 0003/0004/0005) because the drizzle-kit snapshot baseline
-- predates them. lib/db/schema/resume.ts is untouched, so a future db:generate
-- may emit a DROP INDEX for the schema-unknown partial index.
--
-- 1. Keep the earliest pending_claim per (user_id, file_hash); fail the rest so
--    the unique index below can be created on dirty data.
UPDATE "resumes"
SET "status" = 'failed',
    "error_message" = 'Superseded by a newer claim of the same file'
WHERE "status" = 'pending_claim'
  AND "file_hash" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "resumes" "earlier"
    WHERE "earlier"."user_id" = "resumes"."user_id"
      AND "earlier"."file_hash" = "resumes"."file_hash"
      AND "earlier"."status" = 'pending_claim'
      AND ("earlier"."created_at" < "resumes"."created_at"
           OR ("earlier"."created_at" = "resumes"."created_at" AND "earlier"."id" < "resumes"."id"))
  );--> statement-breakpoint
-- 2. Replace the broad arbitration index with the pending_claim-only one.
DROP INDEX IF EXISTS "resumes_user_hash_inflight_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resumes_user_hash_pending_uidx" ON "resumes" USING btree ("user_id","file_hash") WHERE "file_hash" IS NOT NULL AND "status" = 'pending_claim';--> statement-breakpoint
-- 3. Re-assert pending_r2_deletions.r2_key uniqueness (0005's constraint). The
--    index name matches 0005's constraint name so a recorded 0005 makes this a
--    no-op instead of adding a redundant second unique index.
CREATE UNIQUE INDEX IF NOT EXISTS "pending_r2_deletions_r2_key_unique" ON "pending_r2_deletions" USING btree ("r2_key");--> statement-breakpoint
-- 4. Re-assert site_data.resume_id ON DELETE SET NULL, the live-site invariant.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE "conname" = 'site_data_resume_id_resumes_id_fk' AND "confdeltype" = 'n'
  ) THEN
    ALTER TABLE "site_data" DROP CONSTRAINT IF EXISTS "site_data_resume_id_resumes_id_fk";
    ALTER TABLE "site_data" ADD CONSTRAINT "site_data_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
