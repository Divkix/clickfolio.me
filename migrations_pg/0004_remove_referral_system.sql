-- Migration: remove referral system + isPro (unlock all themes)
--
-- Removes the referral tracking machinery and the Pro flag:
--   - referral count maintenance triggers + function
--   - referral_clicks table
--   - user columns: referral_code, referral_count, referred_by, referred_at, is_pro
--
-- Idempotent: every DROP uses IF EXISTS; trigger/function names match
-- migrations_pg/0002_referral_count_triggers.sql.
-- Triggers and the maintain_referral_count() function are dropped BEFORE the
-- user columns they reference.

DROP TRIGGER IF EXISTS user_referral_count_after_insert ON "user";--> statement-breakpoint
DROP TRIGGER IF EXISTS user_referral_count_after_referred_by_set ON "user";--> statement-breakpoint
DROP TRIGGER IF EXISTS user_referral_count_after_referred_by_cleared ON "user";--> statement-breakpoint
DROP TRIGGER IF EXISTS user_referral_count_after_referred_by_moved ON "user";--> statement-breakpoint
DROP TRIGGER IF EXISTS user_referral_count_after_delete ON "user";--> statement-breakpoint
DROP FUNCTION IF EXISTS maintain_referral_count() CASCADE;--> statement-breakpoint

-- Drop referral_clicks table
DROP TABLE IF EXISTS "referral_clicks" CASCADE;--> statement-breakpoint

-- Drop columns from user
ALTER TABLE "user" DROP COLUMN IF EXISTS "referral_code";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "referral_count";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "referred_by";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "referred_at";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "is_pro";--> statement-breakpoint

-- Drop indexes if any remain (column drops remove their indexes too, but be safe)
DROP INDEX IF EXISTS "user_referred_by_idx";
