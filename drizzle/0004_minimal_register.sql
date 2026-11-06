ALTER TABLE "user" ADD COLUMN "username" text;
--> statement-breakpoint
ALTER TABLE staff ADD COLUMN must_change_password boolean DEFAULT true NOT NULL;
--> statement-breakpoint
WITH names AS (
  SELECT id, left(regexp_replace(lower(split_part(email,'@',1)), '[^a-z0-9_]', '_', 'g'), 18) AS stem,
  row_number() OVER (ORDER BY created_at,id) AS ordinal FROM "user"
)
UPDATE "user" u SET username=coalesce(nullif(n.stem,''),'staff')||'_'||n.ordinal FROM names n WHERE u.id=n.id;
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT user_username_unique UNIQUE(username);
--> statement-breakpoint
DELETE FROM session;
