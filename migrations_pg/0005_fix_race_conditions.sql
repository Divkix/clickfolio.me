-- Race-condition fixes: live site survives resume deletion, one pending_claim
-- resume per (user, file hash), no duplicate R2 deletion queue rows.
--
-- Hand-written (like 0003/0004) because drizzle-kit's snapshot baseline
-- (meta/0003_snapshot.json) predates 0004, so `db:generate` would emit
-- unrelated drops. Statements mirror drizzle-kit output style exactly.
--
-- Statement order matters: the drizzle migrator wraps every pending file in one
-- transaction (drizzle-orm/pg-core dialect migrate), so a single failing
-- statement rolls the whole run back and blocks every later file. The two
-- cleanups below therefore run BEFORE the unique DDL they protect, so already
-- duplicated rows cannot abort db:migrate.
--
-- 1. Cleanup: keep the earliest pending_claim per (user_id, file_hash); the
--    duplicate claims that lost the race are failed.
-- 2. Cleanup: keep the newest pending_r2_deletions row per r2_key; redundant
--    duplicates are dropped (the object is still deleted once).
-- 3. pending_r2_deletions.r2_key becomes unique so the delete queue cannot
--    accumulate duplicate rows again (inserts must now use ON CONFLICT DO
--    NOTHING).
-- 4. site_data.resume_id: ON DELETE CASCADE -> SET NULL (column stays
--    nullable). Deleting the source resume must not wipe the published site;
--    readers already treat a null resume_id as normal.
-- 5. resumes_user_hash_inflight_uidx: at most one pending_claim resume per
--    (user_id, file_hash). Only pending_claim is arbitrated: queued/processing/
--    waiting_for_cache rows coexist by design (a duplicate claim inserts a
--    waiting_for_cache clone while the first row is queued/processing), so a
--    broad predicate would abort on existing fan-out pairs. Terminal statuses
--    (completed, failed) are excluded as well, so re-uploading a file after a
--    finished parse is still allowed.
--    (migrations_pg/0006 narrows this index for databases where this file
--    already ran with the earlier broad predicate.)
--
-- No column drops. The two cleanups are the only data writes, authorized for
-- this file because dirty data would otherwise abort the entire migration run.
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
DELETE FROM "pending_r2_deletions" "dupe"
WHERE EXISTS (
  SELECT 1 FROM "pending_r2_deletions" "newer"
  WHERE "newer"."r2_key" = "dupe"."r2_key"
    AND ("newer"."created_at" > "dupe"."created_at"
         OR ("newer"."created_at" = "dupe"."created_at" AND "newer"."id" > "dupe"."id"))
);--> statement-breakpoint
ALTER TABLE "pending_r2_deletions" ADD CONSTRAINT "pending_r2_deletions_r2_key_unique" UNIQUE("r2_key");--> statement-breakpoint
ALTER TABLE "site_data" DROP CONSTRAINT "site_data_resume_id_resumes_id_fk";--> statement-breakpoint
ALTER TABLE "site_data" ADD CONSTRAINT "site_data_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resumes_user_hash_inflight_uidx" ON "resumes" USING btree ("user_id","file_hash") WHERE "file_hash" IS NOT NULL AND "status" = 'pending_claim';
