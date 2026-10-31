CREATE TABLE "indexnow_state" (
	"id" text PRIMARY KEY NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"lease_id" text,
	"lease_until" timestamp with time zone,
	"failures" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexnow_urls" (
	"url" text PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"pending" boolean DEFAULT true NOT NULL,
	"urgent" boolean DEFAULT false NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"last_submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "indexnow_urls_pending_due_idx" ON "indexnow_urls" USING btree ("pending","due_at");