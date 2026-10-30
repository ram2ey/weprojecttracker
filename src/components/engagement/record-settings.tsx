"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { contentRequest, errorMessage } from "@/components/content/client-api";
export function RecordSettings({
  recordId,
  commentsEnabled,
  reminderDays,
  version,
  editable,
}: {
  recordId: string;
  commentsEnabled: boolean;
  reminderDays: number;
  version: number;
  editable: boolean;
}) {
  const [enabled, setEnabled] = useState(commentsEnabled),
    [days, setDays] = useState(reminderDays),
    [lock, setLock] = useState(version),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const data = await contentRequest<{ version: number }>(
        `/api/staff/content/${recordId}/engagement`,
        "PATCH",
        { commentsEnabled: enabled, reminderDays: days, version: lock, reason },
      );
      setLock(data.version);
      setMessage("Engagement settings saved and audited.");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="form-section top-space">
      <h2>Comments & update reminders</h2>
      <p className="subtle-note">
        Approvers can close new comments and set an update reminder interval.
        Zero days disables reminders with the recorded reason. Existing approved
        comments remain visible.
      </p>
      <fieldset
        className="editor-fields form-stack top-space"
        disabled={!editable || busy}
      >
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Allow new guest comments
        </label>
        <label>
          Update reminder interval (days)
          <input
            type="number"
            min={0}
            max={365}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </label>
        <label>
          Settings change reason
          <textarea
            rows={2}
            minLength={10}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <Button
          variant="outline"
          disabled={busy || reason.trim().length < 10}
          onClick={save}
        >
          Save engagement settings
        </Button>
      </fieldset>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
