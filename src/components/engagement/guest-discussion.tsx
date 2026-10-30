"use client";
import { useEffect, useState } from "react";
import { MessageSquare, Flag, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contentRequest, errorMessage } from "@/components/content/client-api";
import type {
  PublicComment,
  OwnSubmission,
  SubmissionKind,
} from "@/lib/engagement/types";
type Discussion = {
  commentsEnabled: boolean;
  comments: PublicComment[];
  own: OwnSubmission[];
  page: number;
  hasMore: boolean;
};
type Challenge = {
  challengeId: string;
  question: string;
  minimumWaitSeconds: number;
};
export function GuestDiscussion({ recordId }: { recordId: string }) {
  const [data, setData] = useState<Discussion | null>(null),
    [kind, setKind] = useState<SubmissionKind | null>(null),
    [parentId, setParent] = useState<string | undefined>(),
    [check, setCheck] = useState<Challenge | null>(null),
    [body, setBody] = useState(""),
    [name, setName] = useState(""),
    [answer, setAnswer] = useState(""),
    [website, setWebsite] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  async function load(page = 1) {
    const result = await contentRequest<Discussion>(
      `/api/public/engagement/${recordId}?page=${page}`,
      "GET",
    );
    setData(result);
  }
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/engagement/${recordId}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Comments could not be loaded.");
        return r.json() as Promise<Discussion>;
      })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled)
          setError("Comments and feedback are available when connected.");
      });
    return () => {
      cancelled = true;
    };
  }, [recordId]);
  async function open(next: SubmissionKind, parent?: string) {
    setKind(next);
    setParent(parent);
    setBody("");
    setAnswer("");
    setCheck(null);
    setMessage("");
    setError("");
    setReady(false);
    try {
      const challenge = await contentRequest<Challenge>(
        "/api/public/engagement/session",
        "GET",
      );
      setCheck(challenge);
      window.setTimeout(
        () => setReady(true),
        challenge.minimumWaitSeconds * 1000,
      );
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!check || !kind) return;
    setBusy(true);
    setError("");
    try {
      const result = await contentRequest<{ message: string }>(
        "/api/public/engagement/submissions",
        "POST",
        {
          recordId,
          kind,
          parentId,
          body,
          displayName: name,
          challengeId: check.challengeId,
          answer,
          website,
        },
      );
      setMessage(result.message);
      setKind(null);
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function withdraw(id: string) {
    setBusy(true);
    setError("");
    try {
      await contentRequest(
        `/api/public/engagement/submissions/${id}`,
        "DELETE",
      );
      setMessage("Your message was withdrawn.");
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-section discussion" id="discussion">
      <h2>Comments & feedback</h2>
      <p>
        Comments are reviewed. Keep messages relevant and respectful. Do not
        include personal details, confidential information or allegations about
        individuals.
      </p>
      <div className="action-row">
        <Button
          variant="outline"
          disabled={busy || !data?.commentsEnabled}
          onClick={() => open("comment")}
        >
          <MessageSquare size={16} />
          Write a comment
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => open("feedback")}
        >
          Send private feedback
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => open("correction")}
        >
          Suggest a correction
        </Button>
      </div>
      {data && !data.commentsEnabled && (
        <p className="notice">
          New comments are closed for this project. Private feedback and
          corrections are still available.
        </p>
      )}
      {kind && (
        <form className="visitor-form form-stack" onSubmit={submit}>
          <h3>
            {kind === "comment"
              ? "Write a public comment"
              : kind === "report"
                ? "Report this comment privately"
                : kind === "correction"
                  ? "Suggest a correction privately"
                  : "Send private feedback"}
          </h3>
          <p className="subtle-note">
            {kind === "comment"
              ? "Your message stays private until approved. Your optional display name will appear with it."
              : "Your message is visible only to authorised staff and on this device. It will not appear in public comments."}{" "}
            No email or public account is needed.
          </p>
          <label>
            Display name (optional)
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoComplete="nickname"
            />
          </label>
          <label>
            Your message
            <textarea
              rows={5}
              minLength={10}
              maxLength={3000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </label>
          <div className="form-honeypot" aria-hidden="true">
            <label>
              Website — leave empty
              <input
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>
          {check ? (
            <label>
              {check.question}
              <input
                inputMode="numeric"
                autoComplete="off"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                maxLength={10}
                required
              />
            </label>
          ) : (
            <p role="status">Preparing a quick check…</p>
          )}
          <div className="action-row">
            <Button type="submit" disabled={busy || !ready || !check}>
              {busy ? "Sending…" : "Send for review"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setKind(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <div className="comment-list">
        {data?.comments.map((comment) => (
          <article className="public-comment" key={comment.id}>
            <header>
              <strong>{comment.displayName}</strong>
              <time dateTime={comment.createdAt}>
                {new Date(comment.createdAt).toLocaleDateString("en-GB", {
                  timeZone: "UTC",
                })}
              </time>
            </header>
            <p className="preserve-lines">{comment.body}</p>
            {comment.replies.map((reply) => (
              <div className="official-response" key={reply.id}>
                <span>
                  <ShieldCheck size={15} />
                  Official response · independently reviewed
                </span>
                <p className="preserve-lines">{reply.body}</p>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => open("report", comment.id)}
            >
              <Flag size={13} />
              Report comment
            </Button>
          </article>
        ))}
      </div>
      {data && !data.comments.length && (
        <p className="subtle-note">No approved comments to display yet.</p>
      )}
      {data && (
        <nav className="pagination" aria-label="Comment pages">
          {data.page > 1 && (
            <Button variant="ghost" onClick={() => load(data.page - 1)}>
              Previous comments
            </Button>
          )}
          {data.hasMore && (
            <Button variant="ghost" onClick={() => load(data.page + 1)}>
              More comments
            </Button>
          )}
        </nav>
      )}
      {!!data?.own.length && (
        <details className="visitor-own">
          <summary>Your messages on this device</summary>
          <p>
            These statuses and private responses are shown only on this browser.
            Clearing browser data removes access to them.
          </p>
          {data.own.map((item) => (
            <article key={item.id}>
              <strong>
                {item.kind} · {item.state}
              </strong>
              <p className="preserve-lines">
                {item.body || "Message withdrawn"}
              </p>
              {item.replies.map((r) => (
                <div className="official-response" key={r.id}>
                  <strong>Reviewed official response</strong>
                  <p>{r.body}</p>
                </div>
              ))}
              {item.state !== "withdrawn" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => withdraw(item.id)}
                >
                  Withdraw my message
                </Button>
              )}
            </article>
          ))}
        </details>
      )}
    </section>
  );
}
