CREATE TABLE "comment_report" (
	"id" text PRIMARY KEY NOT NULL,
	"comment_id" text NOT NULL,
	"reporter_key" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" text,
	CONSTRAINT "comment_report_reason" CHECK ("comment_report"."reason" IS NULL OR "comment_report"."reason" IN ('spam','abuse','private','other'))
);
--> statement-breakpoint
ALTER TABLE "comment_report" ADD CONSTRAINT "comment_report_comment_id_project_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."project_comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_report" ADD CONSTRAINT "comment_report_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "comment_report_reporter_idx" ON "comment_report" USING btree ("comment_id","reporter_key");--> statement-breakpoint
CREATE INDEX "comment_report_open_idx" ON "comment_report" USING btree ("comment_id","resolved_at");