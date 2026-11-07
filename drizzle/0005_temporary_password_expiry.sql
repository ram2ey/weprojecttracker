ALTER TABLE "staff" ADD COLUMN "temporary_password_expires_at" timestamp;
--> statement-breakpoint
-- Preserve existing hashes, allowing already-issued temporary credentials one
-- bounded transition window. Permanent passwords are unaffected.
UPDATE "staff" SET "temporary_password_expires_at" = CURRENT_TIMESTAMP + INTERVAL '24 hours'
WHERE "must_change_password" = true;
