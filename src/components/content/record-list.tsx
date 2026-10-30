import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  FolderOpen,
  ClipboardCheck,
  Globe,
  Archive,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminRecordSummary } from "@/lib/content/types";
import type { Role } from "@/lib/security/policy";
export function RecordList({
  items,
  view,
  page,
  hasMore,
  role,
  stats,
}: {
  items: AdminRecordSummary[];
  view: string;
  page: number;
  hasMore: boolean;
  role: Role;
  stats: {
    total: number;
    pending: number;
    published: number;
    withdrawn: number;
  };
}) {
  const pending = view === "review";
  return (
    <>
      <div className="console-heading">
        <div>
          <span className="eyebrow">
            {pending ? "THE REVIEW DESK" : "YOUR CONSTITUENCY WORKSPACE"}
          </span>
          <h1>
            {pending
              ? "Ready for a second pair of eyes."
              : "The project & content register."}
          </h1>
          <p>
            {pending
              ? "Review submitted information and evidence. The last approved version stays public until a new decision."
              : "Projects, announcements, and reports, with a clear record of every revision."}
          </p>
        </div>
        {role !== "approver" && (
          <Button asChild>
            <Link href="/admin?view=new">
              <Plus size={16} />
              New record
            </Link>
          </Button>
        )}
      </div>
      <div className="console-stats">
        {[
          { label: "Content records", count: stats.total, icon: FolderOpen },
          {
            label: "Awaiting review",
            count: stats.pending,
            icon: ClipboardCheck,
          },
          { label: "Published", count: stats.published, icon: Globe },
          { label: "Withdrawn", count: stats.withdrawn, icon: Archive },
        ].map(({ label, count, icon: Icon }) => (
          <article key={label}>
            <span>
              {label}
              <Icon size={17} />
            </span>
            <strong>{String(count).padStart(2, "0")}</strong>
            <small>Calculated from current records</small>
          </article>
        ))}
      </div>
      <section className="table-panel">
        <div className="panel-heading">
          <div>
            <h2>{pending ? "Pending submissions" : "Latest records"}</h2>
            <p>
              {pending
                ? "Oldest submissions first"
                : "Most recently changed first"}
            </p>
          </div>
        </div>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Content register table"
        >
          <table>
            <thead>
              <tr>
                <th>Record</th>
                <th>Workflow</th>
                <th>Publication</th>
                <th>{pending ? "Waiting" : "Updated"}</th>
                <th>
                  <span className="sr-only">Open record</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link
                      href={`/admin/content/${item.id}?revision=${item.revisionId}`}
                    >
                      {item.title}
                    </Link>
                    <small>
                      {item.code} · {item.kind}
                      {item.community ? ` · ${item.community}` : ""}
                    </small>
                  </td>
                  <td>
                    <Badge
                      tone={
                        item.state === "pending"
                          ? "amber"
                          : item.state === "approved"
                            ? "green"
                            : "neutral"
                      }
                    >
                      {item.state}
                    </Badge>
                  </td>
                  <td>
                    {item.withdrawn ? (
                      <Badge tone="red">Withdrawn</Badge>
                    ) : item.published ? (
                      <Badge tone="green">Published</Badge>
                    ) : (
                      <Badge>Private</Badge>
                    )}
                  </td>
                  <td>
                    {pending && item.submittedAt
                      ? `Since ${new Date(item.submittedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC`
                      : new Date(item.updatedAt).toLocaleDateString("en-GB", {
                          timeZone: "UTC",
                        })}
                  </td>
                  <td>
                    <Link
                      className="text-link"
                      href={`/admin/content/${item.id}?revision=${item.revisionId}`}
                      aria-label={`Open ${item.title}`}
                    >
                      <ArrowUpRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && (
          <div className="empty-state">
            <FolderOpen size={30} />
            <h3>
              {pending
                ? "The review queue is clear."
                : "The first record starts here."}
            </h3>
            <p>
              {pending
                ? "New submissions will appear once an officer sends a draft for review."
                : "Create a private draft to start documenting constituency work."}
            </p>
          </div>
        )}
      </section>
      <div className="pagination">
        {page > 1 && (
          <Link
            className="button button-outline"
            href={`/admin?view=${view}&page=${page - 1}`}
          >
            Previous
          </Link>
        )}
        <span>Page {page}</span>
        {hasMore && (
          <Link
            className="button button-outline"
            href={`/admin?view=${view}&page=${page + 1}`}
          >
            Next
          </Link>
        )}
      </div>
    </>
  );
}
