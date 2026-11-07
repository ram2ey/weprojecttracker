CREATE TABLE "analytics_daily" (
	"day" date NOT NULL,
	"path" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_daily_day_path_pk" PRIMARY KEY("day","path")
);
