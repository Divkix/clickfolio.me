ALTER TABLE `user` ADD `referral_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_referral_code_unique` ON `user` (`referral_code`);--> statement-breakpoint
CREATE INDEX `user_referral_code_idx` ON `user` (`referral_code`);