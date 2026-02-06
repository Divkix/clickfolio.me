ALTER TABLE `user` ADD `show_in_directory` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE user SET show_in_directory = CASE WHEN json_extract(privacy_settings, '$.show_in_directory') = true THEN 1 ELSE 0 END;--> statement-breakpoint
CREATE INDEX `user_show_in_directory_idx` ON `user` (`show_in_directory`);--> statement-breakpoint
CREATE INDEX `site_data_updated_at_idx` ON `site_data` (`updated_at`);