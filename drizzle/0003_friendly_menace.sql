CREATE TABLE "report_source" (
	"id" text PRIMARY KEY NOT NULL,
	"report_record_id" text NOT NULL,
	"source_record_id" text NOT NULL,
	"source_revision_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_source" ADD CONSTRAINT "report_source_report_record_id_content_record_id_fk" FOREIGN KEY ("report_record_id") REFERENCES "public"."content_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_source" ADD CONSTRAINT "report_source_source_record_id_content_record_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."content_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_source" ADD CONSTRAINT "report_source_source_revision_id_content_revision_id_fk" FOREIGN KEY ("source_revision_id") REFERENCES "public"."content_revision"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_source_lookup_idx" ON "report_source" USING btree ("source_record_id","report_record_id");