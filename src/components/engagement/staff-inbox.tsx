"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { contentRequest, errorMessage } from "@/components/content/client-api";
type Notice = {
  id: string;
  kind: string;
  record_id: string | null;
  submission_id: string;
  created_at: string;
  read_at: string | null;
};
type Inbox = { items: Notice[]; unread: number };
const labels: Record<string, string> = {
  guest_submission: "A visitor message needs review",
  official_reply: "An official response needs independent review",
  content_review: "A content revision awaits review",
  overdue_update: "A project is due for an approved update",
  push_failure: "Browser push delivery needs attention",
};
export function StaffInbox() {
  const [data, setData] = useState<Inbox | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    contentRequest<Inbox>("/api/staff/inbox", "GET")
      .then(setData)
      .catch((e) => setMessage(errorMessage(e)));
  }, []);
  async function read(ids: string[]) {
    try {
      await contentRequest("/api/staff/inbox", "POST", { ids });
      setData(await contentRequest<Inbox>("/api/staff/inbox", "GET"));
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }
  return (
    <>
      <div className="console-heading">
        <div>
          <h1>Inbox</h1>
          <p>
            {data ? `${data.unread} unread notices. ` : "Loading notices… "}
          </p>
        </div>
      </div>
      {data?.items.some((n) => !n.read_at) && (
        <Button
          variant="outline"
          onClick={() =>
            read(data.items.filter((n) => !n.read_at).map((n) => n.id))
          }
        >
          Mark displayed notices read
        </Button>
      )}
      <div className="staff-inbox">
        {data?.items.map((n) => (
          <article className={n.read_at ? "read" : "unread"} key={n.id}>
            <div>
              <span className="eyebrow">
                {n.read_at ? "READ" : "UNREAD"} ·{" "}
                {new Date(n.created_at).toLocaleString("en-GB", {
                  timeZone: "UTC",
                })}{" "}
                UTC
              </span>
              <h2>{labels[n.kind] || "Workspace update"}</h2>
              <Link
                className="text-link"
                href={
                  ["guest_submission", "official_reply"].includes(n.kind)
                    ? `/admin?view=engagement&state=all&submission=${n.submission_id}`
                    : n.record_id
                      ? `/admin/content/${n.record_id}`
                      : "/admin?view=reports"
                }
              >
                Open workspace item →
              </Link>
            </div>
            {!n.read_at && (
              <Button size="sm" variant="outline" onClick={() => read([n.id])}>
                Mark read
              </Button>
            )}
          </article>
        ))}
      </div>
      {data && !data.items.length && (
        <p className="empty-state">Your inbox is clear.</p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </>
  );
}
