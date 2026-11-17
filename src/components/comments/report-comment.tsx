"use client";

import { useId, useState, useSyncExternalStore, type FormEvent } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportReasons, type ReportReason } from "@/lib/comments/reasons";

// Remembered in this browser only, so the button can say "Reported".
const storageKey = "wassa.comments.reported";
const changed = "wassa-reports-changed";
function reportedIds(): string {
  try {
    return localStorage.getItem(storageKey) ?? "[]";
  } catch {
    return "[]";
  }
}
function remember(id: string) {
  try {
    const ids: unknown = JSON.parse(reportedIds());
    const list = Array.isArray(ids) ? ids.filter((v) => v !== id) : [];
    localStorage.setItem(
      storageKey,
      JSON.stringify([id, ...list].slice(0, 200)),
    );
  } catch {
    /* The server still ignores repeat reports from this browser. */
  }
  window.dispatchEvent(new Event(changed));
}
function subscribe(update: () => void) {
  window.addEventListener(changed, update);
  window.addEventListener("storage", update);
  return () => {
    window.removeEventListener(changed, update);
    window.removeEventListener("storage", update);
  };
}

export function ReportComment({ id, author }: { id: string; author: string }) {
  const raw = useSyncExternalStore(subscribe, reportedIds, () => "[]");
  const reported = raw.includes(`"${id}"`);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState<ReportReason | null>(null),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const name = useId();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/public/comments/${encodeURIComponent(id)}/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.message || "Could not send your report.");
      remember(id);
      setOpen(false);
      setDone(true);
    } catch (error) {
      setError(
        error instanceof Error && error.message !== "Failed to fetch"
          ? error.message
          : "Could not send your report. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <p role="status" className="comment-report-note">
        Thank you. The office will review this comment.
      </p>
    );
  if (reported)
    return <p className="comment-report-note">You reported this comment.</p>;
  if (!open)
    return (
      <button
        type="button"
        className="comment-report-button"
        onClick={() => setOpen(true)}
        aria-label={`Report comment by ${author}`}
      >
        <Flag aria-hidden="true" />
        Report
      </button>
    );
  return (
    <form className="comment-report-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend>Why are you reporting this comment?</legend>
        {reportReasons.map(([value, label]) => (
          <label key={value} className="checkbox-label">
            <input
              type="radio"
              name={name}
              value={value}
              checked={reason === value}
              onChange={() => setReason(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <p className="subtle-note">
        The comment stays visible until the office reviews it. Reports are
        anonymous.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="comment-actions">
        <Button type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send report"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setError("");
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
