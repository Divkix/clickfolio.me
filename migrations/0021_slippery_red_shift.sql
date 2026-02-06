ALTER TABLE `user` ADD `role_source` text;--> statement-breakpoint
UPDATE "user" SET "role" = 'entry_level' WHERE "role" IN ('recent_graduate', 'junior_professional');--> statement-breakpoint
UPDATE "user" SET "role" = 'mid_level' WHERE "role" = 'mid_level_professional';--> statement-breakpoint
UPDATE "user" SET "role" = 'senior' WHERE "role" = 'senior_professional';--> statement-breakpoint
UPDATE "user" SET "role" = NULL WHERE "role" = 'freelancer';