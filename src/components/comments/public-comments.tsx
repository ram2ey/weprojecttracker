"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import type { CommentPage } from "@/lib/comments/policy";

export function PublicComments({ slug }: { slug: string }) {
  const endpoint = `/api/public/content/${encodeURIComponent(slug)}/comments`;
  const [data, setData] = useState<CommentPage | null>(null);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [name, setName] = useState(""),
    [body, setBody] = useState(""),
    [website, setWebsite] = useState("");
  const [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const submission = useRef<string | null>(null),
    posting = useRef(false),
    loadingRef = useRef(false);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) nameInput.current?.focus();
  }, [open]);
  useEffect(() => {
    if (success && !busy) messageInput.current?.focus();
  }, [success, busy]);
  const load = useCallback(
    async (page: number, signal?: AbortSignal) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch(endpoint + "?page=" + page, {
          cache: "no-store",
          signal,
        });
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 404) {
            setData(null);
            setOpen(false);
          }
          throw new Error(result.message || "Could not load comments.");
        }
        setData(result);
        if (!result.enabled) setOpen(false);
      } catch (error) {
        if (!signal?.aborted)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load comments. Please retry.",
          );
      } finally {
        loadingRef.current = false;
        if (!signal?.aborted) setLoading(false);
      }
    },
    [endpoint],
  );
  useEffect(() => {
    const controller = new AbortController();
    async function initialize() {
      try {
        const response = await fetch(endpoint + "?page=1", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.message || "Could not load comments.");
        if (!controller.signal.aborted) setData(result);
      } catch (error) {
        if (!controller.signal.aborted)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load comments. Please retry.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void initialize();
    return () => controller.abort();
  }, [endpoint]);

  async function session() {
    const response = await fetch(endpoint + "/session", { method: "POST" });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.message || "Could not open the comment form.");
  }
  async function start() {
    if (posting.current) return;
    posting.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await session();
      setOpen(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not open the comment form. Please try again.",
      );
    } finally {
      posting.current = false;
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (posting.current) return;
    posting.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    submission.current ??= crypto.randomUUID();
    try {
      // Also renew an expired guard before a retry; optional statistics are unrelated.
      await session();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission.current,
          displayName: name,
          body,
          website,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "Could not post your comment.");
      setBody("");
      setWebsite("");
      submission.current = null;
      setSuccess(
        result.visible
          ? "Your comment is now public."
          : "This comment was already submitted and has been hidden by the office.",
      );
      await load(1);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not post your comment. Your text is still here; please retry.",
      );
    } finally {
      posting.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="detail-section comments-section"
      aria-labelledby="project-comments-title"
    >
      <h2 id="project-comments-title">Visitor comments</h2>
      <p>Names are not verified. Comments express visitors’ views.</p>
      {loading && <p role="status">Loading comments…</p>}
      {loadError && (
        <div role="alert">
          <p>{loadError}</p>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void load(data?.page ?? 1)}
          >
            Retry loading comments
          </Button>
        </div>
      )}
      {data && (
        <>
          {!data.items.length && !loading && (
            <p>No comments on this page yet.</p>
          )}
          <ul className="comment-list" aria-label="Visitor comments">
            {data.items.map((comment) => (
              <li key={comment.id} className="comment-card">
                <div className="comment-meta">
                  <strong>{comment.displayName}</strong>
                  <time dateTime={comment.createdAt}>
                    {new Date(comment.createdAt).toLocaleString("en-GB", {
                      timeZone: "UTC",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    UTC
                  </time>
                </div>
                <p className="preserve-lines">{comment.body}</p>
              </li>
            ))}
          </ul>
          {(data.page > 1 || data.hasMore) && (
            <nav className="comment-actions" aria-label="Comment pages">
              <Button
                variant="outline"
                disabled={loading || data.page === 1}
                onClick={() => void load(data.page - 1)}
              >
                Newer comments
              </Button>
              <span>Page {data.page}</span>
              <Button
                variant="outline"
                disabled={loading || !data.hasMore}
                onClick={() => void load(data.page + 1)}
              >
                Older comments
              </Button>
            </nav>
          )}
          {!data.enabled ? (
            <p>New comments are closed for this project.</p>
          ) : !open ? (
            <Button disabled={busy} onClick={() => void start()}>
              {busy ? "Opening…" : "Leave a comment"}
            </Button>
          ) : (
            <form
              onSubmit={submit}
              className="comment-form"
              aria-label="Leave a comment"
            >
              <p id="comment-public-notice">
                Your name and comment will appear publicly immediately. Please
                do not include private contact details or sensitive information.
              </p>
              <label htmlFor="comment-name">Name</label>
              <input
                ref={nameInput}
                id="comment-name"
                required
                maxLength={80}
                autoComplete="name"
                value={name}
                disabled={busy}
                onChange={(event) => setName(event.target.value)}
                aria-describedby="comment-public-notice"
              />
              <label htmlFor="comment-message">Comment</label>
              <textarea
                ref={messageInput}
                id="comment-message"
                required
                maxLength={2000}
                rows={5}
                value={body}
                disabled={busy}
                onChange={(event) => setBody(event.target.value)}
              />
              <div className="comment-trap" aria-hidden="true">
                <label htmlFor="comment-website">Leave this field empty</label>
                <input
                  id="comment-website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>
              <div className="comment-actions">
                <Button type="submit" disabled={busy}>
                  {busy ? "Posting…" : "Post comment"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Close form
                </Button>
              </div>
            </form>
          )}
        </>
      )}
      {error && (
        <p role="alert">{error} Your text is kept here. Please try again.</p>
      )}
      {success && <p role="status">{success}</p>}
      <p className="subtle-note">
        To request removal or flag a concern,{" "}
        <Link href="/contact" className="text-link">
          contact the office
        </Link>
        .{" "}
        <Link href="/privacy" className="text-link">
          Privacy &amp; Cookies
        </Link>
      </p>
    </section>
  );
}
