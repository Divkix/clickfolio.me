CREATE TABLE `referral_clicks` (
	`id` text PRIMARY KEY NOT NULL,
	`referrer_user_id` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`source` text,
	`converted` integer DEFAULT false NOT NULL,
	`converted_user_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`referrer_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`converted_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `referral_clicks_referrer_idx` ON `referral_clicks` (`referrer_user_id`);--> statement-breakpoint
CREATE INDEX `referral_clicks_visitor_idx` ON `referral_clicks` (`visitor_hash`);--> statement-breakpoint
CREATE INDEX `referral_clicks_referrer_created_idx` ON `referral_clicks` (`referrer_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `referral_clicks_dedup_idx` ON `referral_clicks` (`referrer_user_id`,`visitor_hash`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer,
	`image` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`handle` text,
	`headline` text,
	`privacy_settings` text DEFAULT '{"show_phone":false,"show_address":false,"hide_from_search":false}' NOT NULL,
	`onboarding_completed` integer DEFAULT false NOT NULL,
	`role` text,
	`referred_by` text
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "name", "email", "email_verified", "image", "created_at", "updated_at", "handle", "headline", "privacy_settings", "onboarding_completed", "role", "referred_by") SELECT "id", "name", "email", "email_verified", "image", "created_at", "updated_at", "handle", "headline", "privacy_settings", "onboarding_completed", "role", "referred_by" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_handle_unique` ON `user` (`handle`);--> statement-breakpoint
CREATE INDEX `user_handle_idx` ON `user` (`handle`);