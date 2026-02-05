DROP INDEX `upload_rate_limits_ip_hash_idx`;--> statement-breakpoint
CREATE INDEX `referral_clicks_referrer_converted_idx` ON `referral_clicks` (`referrer_user_id`,`converted`);--> statement-breakpoint
CREATE INDEX `user_referred_by_idx` ON `user` (`referred_by`);