CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"clerk_id" text,
	"handle" text,
	"headline" text,
	"privacy_settings" jsonb DEFAULT '{"show_phone":false,"show_address":false,"hide_from_search":false,"show_in_directory":true}'::jsonb NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"role" text,
	"role_source" text,
	"referred_by" text,
	"referred_at" timestamp with time zone,
	"is_pro" boolean DEFAULT false NOT NULL,
	"referral_count" integer DEFAULT 0 NOT NULL,
	"referral_code" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"show_in_directory" boolean DEFAULT true NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "user_handle_unique" UNIQUE("handle"),
	CONSTRAINT "user_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_r2_deletions" (
	"id" text PRIMARY KEY NOT NULL,
	"r2_key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "handle_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"old_handle" text,
	"new_handle" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_clicks" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_user_id" text NOT NULL,
	"visitor_hash" text NOT NULL,
	"source" text,
	"converted" boolean DEFAULT false NOT NULL,
	"converted_user_id" text,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"action_type" text DEFAULT 'upload' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"r2_key" text NOT NULL,
	"status" text DEFAULT 'pending_claim' NOT NULL,
	"error_message" text,
	"parsed_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"file_hash" text,
	"parsed_content" jsonb,
	"queued_at" timestamp with time zone,
	"parsed_content_staged" jsonb,
	"last_attempt_error" text,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "site_data" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"resume_id" text,
	"content" jsonb NOT NULL,
	"theme_id" text DEFAULT 'minimalist_editorial',
	"last_published_at" timestamp with time zone,
	"preview_name" text,
	"preview_headline" text,
	"preview_location" text,
	"preview_exp_count" integer,
	"preview_edu_count" integer,
	"preview_skills" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "site_data_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handle_changes" ADD CONSTRAINT "handle_changes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_clicks" ADD CONSTRAINT "referral_clicks_referrer_user_id_user_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_clicks" ADD CONSTRAINT "referral_clicks_converted_user_id_user_id_fk" FOREIGN KEY ("converted_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_data" ADD CONSTRAINT "site_data_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_data" ADD CONSTRAINT "site_data_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_id_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_referred_by_idx" ON "user" USING btree ("referred_by");--> statement-breakpoint
CREATE INDEX "user_show_in_directory_idx" ON "user" USING btree ("show_in_directory");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "pending_r2_deletions_created_at_idx" ON "pending_r2_deletions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "handle_changes_user_id_idx" ON "handle_changes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "handle_changes_user_created_idx" ON "handle_changes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "referral_clicks_referrer_idx" ON "referral_clicks" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE INDEX "referral_clicks_visitor_idx" ON "referral_clicks" USING btree ("visitor_hash");--> statement-breakpoint
CREATE INDEX "referral_clicks_referrer_created_idx" ON "referral_clicks" USING btree ("referrer_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_clicks_dedup_idx" ON "referral_clicks" USING btree ("referrer_user_id","visitor_hash");--> statement-breakpoint
CREATE INDEX "referral_clicks_referrer_converted_idx" ON "referral_clicks" USING btree ("referrer_user_id","converted");--> statement-breakpoint
CREATE INDEX "upload_rate_limits_ip_created_idx" ON "upload_rate_limits" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "upload_rate_limits_expires_idx" ON "upload_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "upload_rate_limits_ip_action_idx" ON "upload_rate_limits" USING btree ("ip_hash","action_type","created_at");--> statement-breakpoint
CREATE INDEX "resumes_user_id_idx" ON "resumes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resumes_file_hash_idx" ON "resumes" USING btree ("file_hash");--> statement-breakpoint
CREATE INDEX "resumes_file_hash_status_idx" ON "resumes" USING btree ("file_hash","status");--> statement-breakpoint
CREATE INDEX "resumes_user_id_created_at_idx" ON "resumes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "resumes_status_idx" ON "resumes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "resumes_status_queued_at_idx" ON "resumes" USING btree ("status","queued_at");--> statement-breakpoint
CREATE INDEX "site_data_resume_id_idx" ON "site_data" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "site_data_updated_at_idx" ON "site_data" USING btree ("updated_at");