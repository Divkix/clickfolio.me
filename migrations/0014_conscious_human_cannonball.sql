ALTER TABLE `user` ADD `referral_count` integer DEFAULT 0 NOT NULL;

-- Backfill referral counts from existing referred_by relationships
UPDATE user SET referral_count = (
  SELECT COUNT(*) FROM user AS u2 WHERE u2.referred_by = user.id
);
