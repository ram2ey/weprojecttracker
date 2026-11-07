CREATE TABLE "project_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"record_id" text NOT NULL,
	"submission_key" text NOT NULL,
	"display_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"hidden_at" timestamp,
	"moderated_at" timestamp,
	"moderated_by" text,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "project_comment_submission_key_unique" UNIQUE("submission_key")
);
--> statement-breakpoint
ALTER TABLE "project_comment" ADD CONSTRAINT "project_comment_record_id_content_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."content_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comment" ADD CONSTRAINT "project_comment_moderated_by_user_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_comment_list_idx" ON "project_comment" USING btree ("record_id","hidden_at","created_at","id");