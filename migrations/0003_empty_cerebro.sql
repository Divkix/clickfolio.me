ALTER TABLE `resumes` ADD `updated_at` text;--> statement-breakpoint
CREATE INDEX `resumes_replicate_job_status_idx` ON `resumes` (`replicate_job_id`,`status`);