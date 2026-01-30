CREATE TABLE `page_views` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`referrer` text,
	`country` text,
	`device_type` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `page_views_user_created_idx` ON `page_views` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `page_views_dedup_idx` ON `page_views` (`visitor_hash`,`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `page_views_created_idx` ON `page_views` (`created_at`);