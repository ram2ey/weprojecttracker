-- Single Admin role (decided 12 November 2026): every staff account can create,
-- approve and publish, and manage staff. The stored value stays "super_admin";
-- the retired "officer" (editor) and "approver" roles are converted. Each
-- change is recorded in the audit log.
INSERT INTO "audit_log" ("id", "actor_id", "action", "subject_id", "details")
SELECT gen_random_uuid()::text, NULL, 'staff.role_changed', "user_id",
       jsonb_build_object('from', "role", 'to', 'super_admin', 'reason', 'single admin role')
FROM "staff"
WHERE "role" <> 'super_admin';
--> statement-breakpoint
UPDATE "staff" SET "role" = 'super_admin' WHERE "role" <> 'super_admin';
