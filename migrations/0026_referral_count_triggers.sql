-- Idempotent re-creation of referral_count triggers.
-- These triggers maintain user.referral_count in sync with user.referred_by.
-- They were first introduced in 0025_steady_gazelle.sql.
--
-- PURPOSE: SQLite drops triggers when a table is dropped and recreated.
-- Drizzle-kit emits a full table rebuild (CREATE __new_user → INSERT → DROP → RENAME)
-- whenever a column is added or altered. This file MUST be appended (renumbered)
-- after any such rebuild migration so the triggers are immediately restored.
--
-- Safe to re-apply: every CREATE is preceded by DROP … IF EXISTS.

DROP TRIGGER IF EXISTS `user_referral_count_after_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `user_referral_count_after_referred_by_set`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `user_referral_count_after_referred_by_cleared`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `user_referral_count_after_referred_by_moved`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `user_referral_count_after_delete`;--> statement-breakpoint

CREATE TRIGGER `user_referral_count_after_insert`
AFTER INSERT ON `user`
WHEN NEW.`referred_by` IS NOT NULL
BEGIN
	UPDATE `user`
	SET `referral_count` = `referral_count` + 1
	WHERE `id` = NEW.`referred_by`;
END;--> statement-breakpoint

CREATE TRIGGER `user_referral_count_after_referred_by_set`
AFTER UPDATE OF `referred_by` ON `user`
WHEN OLD.`referred_by` IS NULL AND NEW.`referred_by` IS NOT NULL
BEGIN
	UPDATE `user`
	SET `referral_count` = `referral_count` + 1
	WHERE `id` = NEW.`referred_by`;
END;--> statement-breakpoint

CREATE TRIGGER `user_referral_count_after_referred_by_cleared`
AFTER UPDATE OF `referred_by` ON `user`
WHEN OLD.`referred_by` IS NOT NULL AND NEW.`referred_by` IS NULL
BEGIN
	UPDATE `user`
	SET `referral_count` = CASE
		WHEN `referral_count` > 0 THEN `referral_count` - 1
		ELSE 0
	END
	WHERE `id` = OLD.`referred_by`;
END;--> statement-breakpoint

CREATE TRIGGER `user_referral_count_after_referred_by_moved`
AFTER UPDATE OF `referred_by` ON `user`
WHEN OLD.`referred_by` IS NOT NULL
	AND NEW.`referred_by` IS NOT NULL
	AND OLD.`referred_by` != NEW.`referred_by`
BEGIN
	UPDATE `user`
	SET `referral_count` = CASE
		WHEN `referral_count` > 0 THEN `referral_count` - 1
		ELSE 0
	END
	WHERE `id` = OLD.`referred_by`;

	UPDATE `user`
	SET `referral_count` = `referral_count` + 1
	WHERE `id` = NEW.`referred_by`;
END;--> statement-breakpoint

CREATE TRIGGER `user_referral_count_after_delete`
AFTER DELETE ON `user`
WHEN OLD.`referred_by` IS NOT NULL
BEGIN
	UPDATE `user`
	SET `referral_count` = CASE
		WHEN `referral_count` > 0 THEN `referral_count` - 1
		ELSE 0
	END
	WHERE `id` = OLD.`referred_by`;
END;
