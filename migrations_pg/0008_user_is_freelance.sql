-- drizzle-kit also emitted the referral/pending_r2_deletions drops and the site_data FK change
-- because meta/ lacked snapshots for 0004-0007; those were applied by 0004/0007 already and are
-- removed here. meta/0008_snapshot.json is now the accurate baseline.
ALTER TABLE "user" ADD COLUMN "is_freelance" boolean DEFAULT false NOT NULL;
