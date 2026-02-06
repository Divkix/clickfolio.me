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
	`privacy_settings` text DEFAULT '{"show_phone":false,"show_address":false,"hide_from_search":false,"show_in_directory":true}' NOT NULL,
	`onboarding_completed` integer DEFAULT false NOT NULL,
	`role` text,
	`referred_by` text,
	`is_pro` integer DEFAULT false NOT NULL,
	`referral_count` integer DEFAULT 0 NOT NULL,
	`referral_code` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`show_in_directory` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "name", "email", "email_verified", "image", "created_at", "updated_at", "handle", "headline", "privacy_settings", "onboarding_completed", "role", "referred_by", "is_pro", "referral_count", "referral_code", "is_admin", "show_in_directory") SELECT "id", "name", "email", "email_verified", "image", "created_at", "updated_at", "handle", "headline", "privacy_settings", "onboarding_completed", "role", "referred_by", "is_pro", "referral_count", "referral_code", "is_admin", "show_in_directory" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_handle_unique` ON `user` (`handle`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_referral_code_unique` ON `user` (`referral_code`);--> statement-breakpoint
CREATE INDEX `user_handle_idx` ON `user` (`handle`);--> statement-breakpoint
CREATE INDEX `user_referred_by_idx` ON `user` (`referred_by`);--> statement-breakpoint
CREATE INDEX `user_show_in_directory_idx` ON `user` (`show_in_directory`);