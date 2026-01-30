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
	`privacy_settings` text DEFAULT '{"show_phone":false,"show_address":false,"hide_from_search":false,"show_in_directory":false}' NOT NULL,
	`onboarding_completed` integer DEFAULT false NOT NULL,
	`role` text,
	`referred_by` text,
	`is_pro` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "name", "email", "email_verified", "image", "created_at", "updated_at", "handle", "headline", "privacy_settings", "onboarding_completed", "role", "referred_by", "is_pro") SELECT "id", "name", "email", "email_verified", "image", "created_at", "updated_at", "handle", "headline", "privacy_settings", "onboarding_completed", "role", "referred_by", "is_pro" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_handle_unique` ON `user` (`handle`);--> statement-breakpoint
CREATE INDEX `user_handle_idx` ON `user` (`handle`);--> statement-breakpoint
ALTER TABLE `site_data` ADD `preview_name` text;--> statement-breakpoint
ALTER TABLE `site_data` ADD `preview_headline` text;--> statement-breakpoint
ALTER TABLE `site_data` ADD `preview_location` text;--> statement-breakpoint
ALTER TABLE `site_data` ADD `preview_exp_count` integer;--> statement-breakpoint
ALTER TABLE `site_data` ADD `preview_edu_count` integer;--> statement-breakpoint
ALTER TABLE `site_data` ADD `preview_skills` text;--> statement-breakpoint
-- Backfill existing site_data rows with preview data extracted from content JSON
UPDATE site_data SET
  preview_name = json_extract(content, '$.full_name'),
  preview_headline = json_extract(content, '$.headline'),
  preview_location = json_extract(content, '$.contact.location'),
  preview_exp_count = json_array_length(json_extract(content, '$.experience')),
  preview_edu_count = json_array_length(json_extract(content, '$.education'));
