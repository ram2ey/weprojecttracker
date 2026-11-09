CREATE TABLE "news_story" (
	"id" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"contributors" jsonb NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"published_at" timestamp with time zone
);
