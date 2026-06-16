CREATE TABLE `pending_r2_deletions` (
	`id` text PRIMARY KEY NOT NULL,
	`r2_key` text NOT NULL,
	`created_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX `pending_r2_deletions_created_at_idx` ON `pending_r2_deletions` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `account_provider_account_id_idx` ON `account` (`provider_id`,`account_id`);