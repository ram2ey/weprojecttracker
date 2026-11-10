ALTER TABLE "project_comment" ALTER COLUMN "record_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "news_story" ADD COLUMN "comments_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "news_story" ADD COLUMN "engagement_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "project_comment" ADD COLUMN "story_id" text;--> statement-breakpoint
ALTER TABLE "project_comment" ADD CONSTRAINT "project_comment_story_id_news_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."news_story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "news_comment_list_idx" ON "project_comment" USING btree ("story_id","hidden_at","created_at","id");--> statement-breakpoint
ALTER TABLE "project_comment" ADD CONSTRAINT "comment_one_subject" CHECK (("project_comment"."record_id" IS NOT NULL) <> ("project_comment"."story_id" IS NOT NULL));