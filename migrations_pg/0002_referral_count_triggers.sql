-- Referral count maintenance triggers — Postgres port of the original
-- SQLite/D1 migration (0026_referral_count_triggers), kept for provenance.
--
-- PURPOSE: keep user.referral_count in sync with user.referred_by.
-- Unlike SQLite, Postgres triggers survive table rewrites (drizzle-kit emits
-- ALTER TABLE for column changes, not DROP/rename), BUT drizzle-kit still does
-- NOT track triggers in its snapshots. After ANY drizzle-kit generate that
-- drops and recreates the `user` table, re-append this file so referral_count
-- keeps updating.
--
-- Safe to re-apply: every CREATE is preceded by DROP ... IF EXISTS.
--
-- Recursion note: these triggers UPDATE `user` themselves, which re-fires them
-- on the referrer row. The nested firings see referred_by unchanged, so every
-- guard fails and recursion terminates after one level (SQLite achieved the
-- same via its default recursive_triggers=off).
--
-- PL/pgSQL notes:
--   - OLD is UNASSIGNED in INSERT triggers and NEW in DELETE triggers; each
--     branch below only touches the records it owns.
--   - SQL boolean operators do not guarantee short-circuit evaluation, so the
--     UPDATE branch checks TG_OP before dereferencing OLD rather than relying
--     on `TG_OP = 'x' OR OLD.fk IS NOT NULL`.

DROP TRIGGER IF EXISTS user_referral_count_after_insert ON "user";
DROP TRIGGER IF EXISTS user_referral_count_after_referred_by_set ON "user";
DROP TRIGGER IF EXISTS user_referral_count_after_referred_by_cleared ON "user";
DROP TRIGGER IF EXISTS user_referral_count_after_referred_by_moved ON "user";
DROP TRIGGER IF EXISTS user_referral_count_after_delete ON "user";

DROP FUNCTION IF EXISTS maintain_referral_count() CASCADE;--> statement-breakpoint

CREATE FUNCTION maintain_referral_count() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		-- Referred user was deleted: decrement their referrer.
		UPDATE "user"
		SET referral_count = CASE WHEN referral_count > 0 THEN referral_count - 1 ELSE 0 END
		WHERE id = OLD.referred_by;
		RETURN OLD;
	END IF;

	IF TG_OP = 'INSERT' THEN
		IF NEW.referred_by IS NOT NULL THEN
			UPDATE "user"
			SET referral_count = referral_count + 1
			WHERE id = NEW.referred_by;
		END IF;
		RETURN NEW;
	END IF;

	-- TG_OP = 'UPDATE': re-credit only when referred_by actually changed.
	IF OLD.referred_by IS DISTINCT FROM NEW.referred_by THEN
		IF OLD.referred_by IS NOT NULL THEN
			UPDATE "user"
			SET referral_count = CASE WHEN referral_count > 0 THEN referral_count - 1 ELSE 0 END
			WHERE id = OLD.referred_by;
		END IF;
		IF NEW.referred_by IS NOT NULL THEN
			UPDATE "user"
			SET referral_count = referral_count + 1
			WHERE id = NEW.referred_by;
		END IF;
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER user_referral_count_after_insert
AFTER INSERT ON "user"
FOR EACH ROW
WHEN (NEW.referred_by IS NOT NULL)
EXECUTE FUNCTION maintain_referral_count();--> statement-breakpoint

CREATE TRIGGER user_referral_count_after_referred_by_set
AFTER UPDATE OF referred_by ON "user"
FOR EACH ROW
WHEN (OLD.referred_by IS NULL AND NEW.referred_by IS NOT NULL)
EXECUTE FUNCTION maintain_referral_count();--> statement-breakpoint

CREATE TRIGGER user_referral_count_after_referred_by_cleared
AFTER UPDATE OF referred_by ON "user"
FOR EACH ROW
WHEN (OLD.referred_by IS NOT NULL AND NEW.referred_by IS NULL)
EXECUTE FUNCTION maintain_referral_count();--> statement-breakpoint

CREATE TRIGGER user_referral_count_after_referred_by_moved
AFTER UPDATE OF referred_by ON "user"
FOR EACH ROW
WHEN (OLD.referred_by IS NOT NULL AND NEW.referred_by IS NOT NULL AND OLD.referred_by <> NEW.referred_by)
EXECUTE FUNCTION maintain_referral_count();--> statement-breakpoint

CREATE TRIGGER user_referral_count_after_delete
AFTER DELETE ON "user"
FOR EACH ROW
WHEN (OLD.referred_by IS NOT NULL)
EXECUTE FUNCTION maintain_referral_count();
