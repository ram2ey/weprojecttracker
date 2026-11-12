CREATE TABLE "notification_device" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "notification_device_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "notification_event" (
	"id" text PRIMARY KEY NOT NULL,
	"dedupe_key" text NOT NULL,
	"record_id" text,
	"story_id" text,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"category_id" text,
	"community_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"retired_at" timestamp,
	"fanout_at" timestamp,
	CONSTRAINT "notification_event_dedupe_key_unique" UNIQUE("dedupe_key"),
	CONSTRAINT "notification_event_subject" CHECK (("notification_event"."record_id" is null) <> ("notification_event"."story_id" is null))
);
--> statement-breakpoint
CREATE TABLE "notification_follow" (
	"device_id" text NOT NULL,
	"kind" text NOT NULL,
	"target" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_follow_device_id_kind_target_pk" PRIMARY KEY("device_id","kind","target"),
	CONSTRAINT "notification_follow_kind" CHECK ("notification_follow"."kind" in ('project','category','community','news'))
);
--> statement-breakpoint
CREATE TABLE "notification_receipt" (
	"event_id" text NOT NULL,
	"device_id" text NOT NULL,
	"read_at" timestamp,
	"state" text DEFAULT 'pending' NOT NULL,
	"generation" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"lease_until" timestamp,
	"claim_token" text,
	"last_status" integer,
	CONSTRAINT "notification_receipt_event_id_device_id_pk" PRIMARY KEY("event_id","device_id"),
	CONSTRAINT "notification_receipt_state" CHECK ("notification_receipt"."state" in ('pending','sending','retry','sent','skipped','cancelled','failed'))
);
--> statement-breakpoint
CREATE TABLE "notification_subscription" (
	"device_id" text PRIMARY KEY NOT NULL,
	"endpoint_hash" text NOT NULL,
	"credentials" text NOT NULL,
	"generation" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_subscription_endpoint_hash_unique" UNIQUE("endpoint_hash")
);
--> statement-breakpoint
ALTER TABLE "notification_event" ADD CONSTRAINT "notification_event_record_id_content_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."content_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_event" ADD CONSTRAINT "notification_event_story_id_news_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."news_story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_follow" ADD CONSTRAINT "notification_follow_device_id_notification_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."notification_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_receipt" ADD CONSTRAINT "notification_receipt_event_id_notification_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."notification_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_receipt" ADD CONSTRAINT "notification_receipt_device_id_notification_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."notification_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_subscription" ADD CONSTRAINT "notification_subscription_device_id_notification_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."notification_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_event_time_idx" ON "notification_event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notification_event_fanout_idx" ON "notification_event" USING btree ("fanout_at","created_at");--> statement-breakpoint
CREATE INDEX "notification_follow_target_idx" ON "notification_follow" USING btree ("kind","target");--> statement-breakpoint
CREATE INDEX "notification_receipt_inbox_idx" ON "notification_receipt" USING btree ("device_id","read_at");--> statement-breakpoint
CREATE INDEX "notification_receipt_dispatch_idx" ON "notification_receipt" USING btree ("state","next_attempt_at");