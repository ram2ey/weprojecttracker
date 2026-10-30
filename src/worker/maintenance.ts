import { getPool } from "../db";
export async function runMaintenance() {
  const pool = getPool();
  await pool.query(
    "DELETE FROM guest_challenge WHERE expires_at<NOW()-INTERVAL '1 day'",
  );
  await pool.query(
    "DELETE FROM guest_submission WHERE NOT (kind='comment' AND state='approved') AND created_at<NOW()-INTERVAL '12 months'",
  );
  await pool.query(
    "DELETE FROM abuse_log WHERE created_at<NOW()-INTERVAL '30 days'",
  );
  await pool.query(
    "DELETE FROM app_rate_limit WHERE resets_at<NOW()-INTERVAL '1 day'",
  );
  await pool.query(
    "DELETE FROM push_subscription WHERE updated_at<NOW()-INTERVAL '180 days'",
  );
  await pool.query(
    "DELETE FROM guest_device WHERE last_seen_at<NOW()-INTERVAL '12 months' AND NOT EXISTS (SELECT 1 FROM push_subscription p WHERE p.device_id=guest_device.id)",
  );
  await pool.query(
    "DELETE FROM push_job WHERE state IN ('sent','failed','cancelled') AND updated_at<NOW()-INTERVAL '30 days'",
  );
  await runReminders();
  await pool.query(
    "DELETE FROM staff_notice WHERE created_at<NOW()-INTERVAL '12 months'",
  );
  return { maintained: true };
}
export async function runReminders() {
  const pool = getPool();
  await pool.query(
    `INSERT INTO staff_notice (id,recipient_id,record_id,kind,dedupe_key,subject_id) SELECT gen_random_uuid()::text,s.user_id,r.id,'overdue_update','overdue:'||r.id||':'||v.id||':'||r.reminder_days||':'||s.user_id,v.id FROM content_record r JOIN content_revision v ON v.id=r.published_revision_id AND v.record_id=r.id CROSS JOIN staff s WHERE s.active=true AND r.kind='project' AND r.withdrawn_at IS NULL AND v.state='approved' AND v.payload->>'status' IN ('Ongoing','Delayed') AND r.reminder_days>0 AND v.decided_at<NOW()-r.reminder_days*INTERVAL '1 day' ON CONFLICT (dedupe_key) DO NOTHING`,
  );
  // Transactional audit events supply inbox notices without coupling publication
  // commits to worker uptime. The unique key makes repeated scans idempotent.
  await pool.query(
    `INSERT INTO staff_notice (id,recipient_id,record_id,kind,dedupe_key,subject_id) SELECT gen_random_uuid()::text,s.user_id,r.id,'content_review','review:'||v.id||':'||s.user_id,v.id FROM content_record r JOIN content_revision v ON v.record_id=r.id CROSS JOIN staff s WHERE v.state='pending' AND s.active=true AND s.role IN ('approver','super_admin') AND NOT (v.contributors ? s.user_id) AND v.submitted_by IS DISTINCT FROM s.user_id ON CONFLICT (dedupe_key) DO NOTHING`,
  );
  return { reminded: true };
}
