CREATE TABLE "abuse_log" (
	"id" text PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_challenge" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"answer_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "guest_device" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guest_device_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "guest_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"record_id" text NOT NULL,
	"device_id" text,
	"staff_author_id" text,
	"kind" text NOT NULL,
	"parent_id" text,
	"display_name" text,
	"body" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	"decided_by" text,
	"decision_reason" text
);
--> statement-breakpoint
CREATE TABLE "official_reply" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	"decided_by" text,
	"decision_reason" text
);
--> statement-breakpoint
CREATE TABLE "push_job" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"record_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"last_status" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"endpoint_hash" text NOT NULL,
	"credentials" text NOT NULL,
	"record_ids" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_status" integer,
	CONSTRAINT "push_subscription_endpoint_hash_unique" UNIQUE("endpoint_hash")
);
--> statement-breakpoint
CREATE TABLE "staff_notice" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_id" text NOT NULL,
	"record_id" text,
	"kind" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"subject_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp,
	CONSTRAINT "staff_notice_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
ALTER TABLE "content_record" ADD COLUMN "comments_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "content_record" ADD COLUMN "reminder_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "content_record" ADD COLUMN "engagement_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_challenge" ADD CONSTRAINT "guest_challenge_device_id_guest_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."guest_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_submission" ADD CONSTRAINT "guest_submission_record_id_content_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."content_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_submission" ADD CONSTRAINT "guest_submission_device_id_guest_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."guest_device"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_submission" ADD CONSTRAINT "guest_submission_staff_author_id_user_id_fk" FOREIGN KEY ("staff_author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_submission" ADD CONSTRAINT "guest_submission_parent_id_guest_submission_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."guest_submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_submission" ADD CONSTRAINT "guest_submission_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_reply" ADD CONSTRAINT "official_reply_submission_id_guest_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."guest_submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_reply" ADD CONSTRAINT "official_reply_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_reply" ADD CONSTRAINT "official_reply_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_job" ADD CONSTRAINT "push_job_subscription_id_push_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."push_subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_job" ADD CONSTRAINT "push_job_record_id_content_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."content_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_job" ADD CONSTRAINT "push_job_revision_id_content_revision_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."content_revision"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_device_id_guest_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."guest_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_notice" ADD CONSTRAINT "staff_notice_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_notice" ADD CONSTRAINT "staff_notice_record_id_content_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."content_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abuse_retention_idx" ON "abuse_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "submission_queue_idx" ON "guest_submission" USING btree ("state","created_at");--> statement-breakpoint
CREATE INDEX "submission_public_idx" ON "guest_submission" USING btree ("record_id","kind","state");--> statement-breakpoint
CREATE INDEX "reply_queue_idx" ON "official_reply" USING btree ("state","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_revision_unique" ON "push_job" USING btree ("subscription_id","revision_id");--> statement-breakpoint
CREATE INDEX "push_dispatch_idx" ON "push_job" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notice_inbox_idx" ON "staff_notice" USING btree ("recipient_id","read_at","created_at");