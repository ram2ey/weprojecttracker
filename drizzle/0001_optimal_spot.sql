CREATE TYPE "public"."content_kind" AS ENUM('project', 'announcement', 'report');--> statement-breakpoint
CREATE TYPE "public"."revision_state" AS ENUM('draft', 'pending', 'returned', 'rejected', 'approved');--> statement-breakpoint
CREATE TYPE "public"."taxonomy_kind" AS ENUM('category', 'subcategory', 'community');--> statement-breakpoint
CREATE TABLE "content_record" (
	"id" text PRIMARY KEY NOT NULL,
	"number" serial NOT NULL,
	"kind" "content_kind" NOT NULL,
	"slug" text NOT NULL,
	"created_by" text NOT NULL,
	"published_revision_id" text,
	"version" integer DEFAULT 0 NOT NULL,
	"withdrawn_at" timestamp,
	"withdrawal_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "content_record_number_unique" UNIQUE("number"),
	CONSTRAINT "content_record_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "content_revision" (
	"id" text PRIMARY KEY NOT NULL,
	"record_id" text NOT NULL,
	"number" integer NOT NULL,
	"state" "revision_state" DEFAULT 'draft' NOT NULL,
	"lock_version" integer DEFAULT 0 NOT NULL,
	"base_version" integer NOT NULL,
	"author_id" text NOT NULL,
	"contributors" jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	"financials" jsonb NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp,
	"decided_by" text,
	"decided_at" timestamp,
	"decision_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_file" (
	"id" text PRIMARY KEY NOT NULL,
	"record_id" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"thumbnail_key" text,
	"internal_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp,
	"withdrawal_reason" text,
	"withdrawn_by" text,
	CONSTRAINT "media_file_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "taxonomy" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "taxonomy_kind" NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_record" ADD CONSTRAINT "content_record_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_record" ADD CONSTRAINT "content_record_published_revision_id_content_revision_id_fk" FOREIGN KEY ("published_revision_id") REFERENCES "public"."content_revision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revision" ADD CONSTRAINT "content_revision_record_id_content_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."content_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revision" ADD CONSTRAINT "content_revision_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revision" ADD CONSTRAINT "content_revision_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revision" ADD CONSTRAINT "content_revision_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_file" ADD CONSTRAINT "media_file_record_id_content_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."content_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_file" ADD CONSTRAINT "media_file_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_file" ADD CONSTRAINT "media_file_withdrawn_by_user_id_fk" FOREIGN KEY ("withdrawn_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomy" ADD CONSTRAINT "taxonomy_parent_id_taxonomy_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."taxonomy"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "record_public_idx" ON "content_record" USING btree ("kind","withdrawn_at");--> statement-breakpoint
CREATE INDEX "record_updated_idx" ON "content_record" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "revision_record_number_unique" ON "content_revision" USING btree ("record_id","number");--> statement-breakpoint
CREATE INDEX "revision_queue_idx" ON "content_revision" USING btree ("state","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "revision_one_active_per_record" ON "content_revision" USING btree ("record_id") WHERE "content_revision"."state" in ('draft', 'pending');--> statement-breakpoint
CREATE INDEX "media_record_idx" ON "media_file" USING btree ("record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "taxonomy_name_unique" ON "taxonomy" USING btree ("kind",coalesce("parent_id", ''),lower("name"));
--> statement-breakpoint
INSERT INTO taxonomy (id, kind, name) VALUES ('category-education','category','Education'), ('category-health','category','Health'), ('category-general','category','General'), ('category-community','category','Community Development'), ('category-social','category','Social Amenities') ON CONFLICT DO NOTHING;
