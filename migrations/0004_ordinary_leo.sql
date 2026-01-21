DROP INDEX `resumes_replicate_job_id_idx`;--> statement-breakpoint
DROP INDEX `resumes_replicate_job_status_idx`;--> statement-breakpoint
ALTER TABLE `resumes` DROP COLUMN `replicate_job_id`;