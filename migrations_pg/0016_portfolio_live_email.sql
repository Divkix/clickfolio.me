ALTER TABLE "user" ADD COLUMN "live_email_sent_at" timestamp with time zone;
--> statement-breakpoint
-- Portfolios already live before this email existed must never receive it.
UPDATE "user" SET "live_email_sent_at" = "site_data"."last_published_at"
FROM "site_data"
WHERE "site_data"."user_id" = "user"."id"
  AND "user"."handle" IS NOT NULL
  AND "site_data"."last_published_at" IS NOT NULL
  AND ("site_data"."resume_id" IS NOT NULL OR "site_data"."content"->>'full_name' IS DISTINCT FROM 'Pending');