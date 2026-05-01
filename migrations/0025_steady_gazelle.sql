-- Referral system hardening:
-- - Backfill referral_count (source of truth: user.referred_by)
-- - Backfill timestamps for analytics (referred_at, converted_at)
-- - Add triggers to keep referral_count consistent going forward

-- Backfill referral_count from user.referred_by
UPDATE `user`
SET `referral_count` = (
		SELECT COUNT(*)
		FROM `user` AS `u2`
		WHERE `u2`.`referred_by` = `user`.`id`
	);--> statement-breakpoint

-- Backfill referred_at for already-referred users (best available approximation)
UPDATE `user`
SET `referred_at` = `created_at`
WHERE `referred_by` IS NOT NULL
	AND (`referred_at` IS NULL OR `referred_at` = "");--> statement-breakpoint

-- Backfill converted_at for already-converted clicks (best available approximation)
UPDATE `referral_clicks`
SET `converted_at` = `created_at`
WHERE `converted` = 1
	AND (`converted_at` IS NULL OR `converted_at` = "");--> statement-breakpoint

-- Triggers: keep user.referral_count in sync with user.referred_by.
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

