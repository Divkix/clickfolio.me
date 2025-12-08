CREATE INDEX `handle_changes_user_created_idx` ON `handle_changes` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `resumes_file_hash_status_idx` ON `resumes` (`file_hash`,`status`);--> statement-breakpoint
CREATE INDEX `resumes_user_id_created_at_idx` ON `resumes` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `resumes_status_idx` ON `resumes` (`status`);--> statement-breakpoint
CREATE INDEX `upload_rate_limits_ip_created_idx` ON `upload_rate_limits` (`ip_hash`,`created_at`);