"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { contentRequest, errorMessage } from "@/components/content/client-api";
import type { ModerationRow } from "@/lib/engagement/types";
import type { Role } from "@/lib/security/policy";
function Item({
  row,
  actorId,
  role,
}: {
  row: ModerationRow;
  actorId: string;
  role: Role;
}) {
  const router = useRouter();
  const [reason, setReason] = useState(""),
    [reply, setReply] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const canReview = role !== "officer",
    canRespond = role !== "approver";
  async function act(action: string, replyId?: string, version = row.version) {
    setBusy(true);
    setMessage("");
    try {
      await contentRequest(
        replyId
          ? `/api/staff/engagement/replies/${replyId}`
          : `/api/staff/engagement/${row.id}`,
        "POST",
        action === "respond"
          ? { action, body: reply }
          : { action, reason, reviewed, version },
      );
      setMessage(
        action === "respond"
          ? "Response submitted for independent review."
          : "Decision recorded.",
      );
      setReply("");
      router.refresh();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const valid = reason.trim().length >= 10 && !busy;
  return (
    <article className="moderation-item" id={row.id}>
      <header>
        <div>
          <span className="eyebrow">
            {row.kind.toUpperCase()} ·{" "}
            {new Date(row.created_at).toLocaleString("en-GB", {
              timeZone: "UTC",
            })}{" "}
            UTC
          </span>
          <h2>{row.title}</h2>
        </div>
        <Badge
          tone={
            row.state === "pending"
              ? "amber"
              : row.state === "approved"
                ? "green"
                : "neutral"
          }
        >
          {row.state}
        </Badge>
      </header>
      <Link className="text-link" href={`/admin/content/${row.record_id}`}>
        Open project record →
      </Link>
      <p>
        <strong>{row.display_name || "Guest"}</strong>
        {row.kind !== "comment" && " · Private submission"}
      </p>
      <p className="preserve-lines">{row.body || "Content withdrawn"}</p>
      {row.decision_reason && (
        <p className="subtle-note">Decision: {row.decision_reason}</p>
      )}
      {canReview && (
        <div className="form-stack top-space">
          <label>
            Moderation reason
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={10}
              maxLength={1000}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            I checked suitability, privacy, and internal information for the
            intended audience.
          </label>
          <div className="action-row">
            {row.state === "pending" && row.staff_author_id !== actorId && (
              <>
                {row.kind === "comment" ? (
                  <Button
                    disabled={!valid || !reviewed}
                    onClick={() => act("approve")}
                  >
                    Approve comment
                  </Button>
                ) : (
                  <Button disabled={!valid} onClick={() => act("resolve")}>
                    Mark resolved
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={!valid}
                  onClick={() => act("reject")}
                >
                  Reject submission
                </Button>
              </>
            )}
            {row.state === "approved" && row.kind === "comment" && (
              <Button
                variant="outline"
                disabled={!valid}
                onClick={() => act("withdraw")}
              >
                Withdraw public comment
              </Button>
            )}
          </div>
          {row.staff_author_id === actorId && row.state === "pending" && (
            <p className="notice">
              Another approver must review your submission.
            </p>
          )}
        </div>
      )}
      {row.replies.map((item) => (
        <section className="official-response" key={item.id}>
          <strong>Official response · {item.state}</strong>
          <p className="preserve-lines">{item.body}</p>
          {item.decision_reason && <p>Decision: {item.decision_reason}</p>}
          {canReview &&
            item.state === "pending" &&
            item.author_id !== actorId && (
              <div className="action-row">
                <Button
                  disabled={!valid || !reviewed}
                  onClick={() => act("approve", item.id, item.version)}
                >
                  Approve response
                </Button>
                <Button
                  variant="outline"
                  disabled={!valid}
                  onClick={() => act("reject", item.id, item.version)}
                >
                  Reject response
                </Button>
              </div>
            )}
          {item.state === "pending" && item.author_id === actorId && (
            <p className="notice">Your response requires another approver.</p>
          )}
          {canReview && item.state === "approved" && (
            <Button
              variant="outline"
              disabled={!valid}
              onClick={() => act("withdraw", item.id, item.version)}
            >
              Withdraw response
            </Button>
          )}
        </section>
      ))}
      {canRespond &&
        row.kind !== "report" &&
        !["withdrawn", "rejected"].includes(row.state) &&
        (row.kind !== "comment" || row.state === "approved") &&
        !row.replies.some((r) => r.state === "pending") && (
          <div className="form-stack top-space">
            <label>
              Prepare an official response
              <textarea
                rows={3}
                minLength={10}
                maxLength={3000}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
            </label>
            <p className="subtle-note">
              {row.kind === "comment"
                ? "This response will be public after independent approval."
                : "This response will be visible privately to the submitting device after independent approval."}
            </p>
            <Button
              variant="outline"
              disabled={busy || reply.trim().length < 10}
              onClick={() => act("respond")}
            >
              Send response for review
            </Button>
          </div>
        )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </article>
  );
}
export function ModerationPanel({
  items,
  page,
  hasMore,
  actorId,
  role,
  state,
  kind,
}: {
  items: ModerationRow[];
  page: number;
  hasMore: boolean;
  actorId: string;
  role: Role;
  state: string;
  kind: string;
}) {
  return (
    <>
      <div className="console-heading">
        <div>
          <h1>Comments & feedback</h1>
          <p>Review comments, private feedback and official responses.</p>
        </div>
      </div>
      <form className="action-row moderation-filters" action="/admin">
        <input name="view" value="engagement" type="hidden" />
        <label>
          Submission status
          <select name="state" defaultValue={state}>
            {[
              "pending",
              "approved",
              "resolved",
              "rejected",
              "withdrawn",
              "all",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Submission type
          <select name="kind" defaultValue={kind}>
            {["all", "comment", "feedback", "correction", "report"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          Apply filters
        </Button>
      </form>
      {items.map((row) => (
        <Item key={row.id} row={row} actorId={actorId} role={role} />
      ))}
      {!items.length && (
        <div className="empty-state">
          <h2>No submissions in this view.</h2>
          <p>
            New visitor messages and pending official replies will appear here.
          </p>
        </div>
      )}
      <nav className="pagination" aria-label="Moderation pages">
        {page > 1 && (
          <Link
            href={`/admin?view=engagement&state=${state}&kind=${kind}&page=${page - 1}`}
          >
            Previous
          </Link>
        )}
        <span>Page {page}</span>
        {hasMore && (
          <Link
            href={`/admin?view=engagement&state=${state}&kind=${kind}&page=${page + 1}`}
          >
            Next
          </Link>
        )}
      </nav>
    </>
  );
}
