"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { canSubmit, type Role } from "@/lib/security/policy";
import {
  projectStatuses,
  type AdminRecord,
  type LaunchPayload,
  type Taxonomy,
  type AdminFile,
} from "@/lib/content/types";
import { contentRequest, errorMessage } from "./client-api";
import { useUnsavedChanges } from "./unsaved-changes";
import { publicationErrors } from "@/lib/content/validation";
export function RecordEditor({
  record,
  revisionId,
  actorId,
  role,
  terms,
}: {
  record: AdminRecord;
  revisionId: string;
  actorId: string;
  role: Role;
  terms: Taxonomy[];
}) {
  const router = useRouter(),
    revision = record.revisions.find((r) => r.id === revisionId)!,
    [payload, setPayload] = useState<LaunchPayload>(revision.payload),
    [baseline, setBaseline] = useState(JSON.stringify(revision.payload)),
    [lockVersion, setLockVersion] = useState(revision.lockVersion),
    [files, setFiles] = useState(record.files),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [reason, setReason] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [recovery, setRecovery] = useState(false),
    form = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(payload) !== baseline,
    canLeave = useUnsavedChanges(dirty),
    editable = revision.state === "draft" && canSubmit(role),
    reviewer = role !== "officer",
    independent =
      revision.authorId !== actorId &&
      !revision.contributors.includes(actorId) &&
      revision.submittedBy !== actorId;
  function field<K extends keyof LaunchPayload>(
    key: K,
    value: LaunchPayload[K],
  ) {
    setPayload((p) => ({ ...p, [key]: value }));
  }
  async function operation(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(submit: boolean) {
    if (!form.current?.reportValidity()) return;
    if (submit) {
      const issues = publicationErrors(payload);
      if (issues.length) {
        setMessage("");
        setError("Before submission: " + issues.join(" "));
        return;
      }
    }
    await operation(async () => {
      const { categoryName, communityName, ...input } = payload;
      void categoryName;
      void communityName;
      const result = await contentRequest<{ lockVersion: number }>(
        "/api/staff/content/" + record.id + "/revisions/" + revision.id,
        "PATCH",
        { payload: input, lockVersion },
      );
      setLockVersion(result.lockVersion);
      setBaseline(JSON.stringify(payload));
      if (submit) {
        await contentRequest(
          "/api/staff/content/" + record.id + "/revisions/" + revision.id,
          "POST",
          { action: "submit", lockVersion: result.lockVersion },
        );
        setLockVersion(result.lockVersion + 1);
        setMessage("Submitted for independent review.");
      } else setMessage("Draft saved privately.");
      router.refresh();
    });
  }
  async function decision(action: "approve" | "return") {
    await operation(async () => {
      await contentRequest(
        "/api/staff/content/" + record.id + "/revisions/" + revision.id,
        "POST",
        { action, reason, evidenceReviewed: reviewed, lockVersion },
      );
      setLockVersion((v) => v + 1);
      setMessage(
        action === "approve"
          ? "Approved and published."
          : "Returned for correction.",
      );
      router.refresh();
    });
  }
  async function revise() {
    if (!canLeave()) return;
    await operation(async () => {
      const r = await contentRequest<{ revisionId: string }>(
        "/api/staff/content/" + record.id,
        "POST",
        { action: "revise", sourceRevisionId: revision.id },
      );
      router.push("/admin/content/" + record.id + "?revision=" + r.revisionId);
    });
  }
  async function upload(file: File) {
    await operation(async () => {
      const data = new FormData();
      data.set("file", file);
      const r = await fetch("/api/staff/content/" + record.id + "/media", {
          method: "POST",
          body: data,
        }),
        item = await r.json();
      if (!r.ok) throw new Error(item.message);
      setFiles((old) => [...old, item as AdminFile]);
      setPayload((p) => ({
        ...p,
        attachments: [...p.attachments, { id: item.id, caption: "" }],
      }));
      setMessage("Photograph uploaded privately. Save the draft to attach it.");
    });
  }
  return (
    <>
      <Link href="/admin" className="text-link">
        ← Project register
      </Link>
      <div className="console-heading">
        <div>
          <span className="eyebrow">
            {record.code} · Revision {revision.number}
          </span>
          <h1>{payload.title}</h1>
          {record.withdrawnAt && <p>This project is withdrawn.</p>}
        </div>
        <Badge>{revision.state}</Badge>
      </div>
      <div className="revision-toolbar">
        <label>
          Revision history
          <select
            aria-label="Revision history"
            value={revision.id}
            onChange={(e) => {
              if (canLeave())
                router.push(
                  "/admin/content/" + record.id + "?revision=" + e.target.value,
                );
            }}
          >
            {record.revisions.map((r) => (
              <option key={r.id} value={r.id}>
                Revision {r.number} · {r.state}
              </option>
            ))}
          </select>
        </label>
        {record.publishedRevisionId && !record.withdrawnAt && (
          <Link href={"/projects/" + record.slug} target="_blank">
            View published project ↗
          </Link>
        )}
        {canSubmit(role) &&
          !record.revisions.some(
            (r) => r.state === "draft" || r.state === "pending",
          ) && (
            <Button disabled={busy} onClick={revise}>
              Create a new draft
            </Button>
          )}
      </div>
      {revision.decisionReason && (
        <p className="notice">{revision.decisionReason}</p>
      )}
      <form
        ref={form}
        className="record-editor"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void save(false);
        }}
      >
        <fieldset
          disabled={!editable || busy}
          className="form-section form-stack"
        >
          <legend>Project details</legend>
          <p id="submission-help" className="subtle-note">
            Required for submission: title, description (at least 20
            characters), category, community and information source. You can
            save an unfinished draft privately. Completed projects also need a
            valid completion date, summary (at least 10 characters) and a
            photograph.
          </p>
          <label>
            Title
            <input
              aria-label="Title"
              value={payload.title}
              minLength={3}
              maxLength={160}
              required
              onChange={(e) => field("title", e.target.value)}
            />
          </label>
          <label>
            Description
            <textarea
              aria-label="Description"
              aria-required="true"
              aria-describedby="submission-help"
              rows={6}
              value={payload.description}
              maxLength={15000}
              onChange={(e) => field("description", e.target.value)}
            />
          </label>
          <div className="form-columns">
            <label>
              Category
              <select
                aria-label="Category"
                aria-required="true"
                value={payload.categoryId}
                onChange={(e) => field("categoryId", e.target.value)}
              >
                <option value="">Choose a category</option>
                {terms
                  .filter((t) => t.kind === "category")
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Community
              <select
                aria-label="Community"
                aria-required="true"
                value={payload.communityId}
                onChange={(e) => field("communityId", e.target.value)}
              >
                <option value="">Choose a community</option>
                {terms
                  .filter(
                    (t) =>
                      t.kind === "community" &&
                      (t.active || t.id === payload.communityId),
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {!t.active ? " (retired)" : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Status
              <select
                aria-label="Status"
                value={payload.status}
                onChange={(e) =>
                  field("status", e.target.value as LaunchPayload["status"])
                }
              >
                {projectStatuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Information source
            <textarea
              aria-label="Information source"
              aria-required="true"
              aria-describedby="submission-help"
              rows={2}
              maxLength={2000}
              value={payload.source}
              onChange={(e) => field("source", e.target.value)}
            />
          </label>
          {payload.status === "Completed" && (
            <div className="form-stack">
              <label>
                Completion date
                <input
                  type="date"
                  aria-required="true"
                  value={payload.actualCompletionDate}
                  onChange={(e) =>
                    field("actualCompletionDate", e.target.value)
                  }
                />
              </label>
              <label>
                Completion summary
                <textarea
                  rows={3}
                  aria-required="true"
                  maxLength={4000}
                  value={payload.completionSummary}
                  onChange={(e) => field("completionSummary", e.target.value)}
                />
              </label>
              <p className="subtle-note">
                Completed projects need a completion date, summary and at least
                one photograph.
              </p>
            </div>
          )}
          <h2>Photographs</h2>
          {editable && (
            <label>
              Upload photograph
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void upload(f);
                }}
              />
            </label>
          )}
          {payload.attachments.map((a) => {
            const f = files.find((f) => f.id === a.id);
            return (
              <div className="attachment-row" key={a.id}>
                <a
                  href={"/api/media/" + a.id}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Image
                    src={"/api/media/" + a.id + "?variant=thumbnail"}
                    alt={a.caption || "Project photograph"}
                    width={160}
                    height={120}
                    unoptimized
                  />
                </a>
                <div>
                  <label>
                    Photograph caption
                    <textarea
                      rows={2}
                      value={a.caption}
                      maxLength={500}
                      onChange={(e) =>
                        field(
                          "attachments",
                          payload.attachments.map((p) =>
                            p.id === a.id
                              ? { ...p, caption: e.target.value }
                              : p,
                          ),
                        )
                      }
                    />
                  </label>
                  {f?.withdrawn && (
                    <p className="form-error">
                      Withdrawn photograph: remove it before submitting.
                    </p>
                  )}
                  {editable && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        field(
                          "attachments",
                          payload.attachments.filter((p) => p.id !== a.id),
                        )
                      }
                    >
                      Remove photograph
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {!payload.attachments.length && <p>No photographs attached.</p>}
          {editable &&
            files.some(
              (f) =>
                !f.withdrawn && !payload.attachments.some((a) => a.id === f.id),
            ) && (
              <details>
                <summary>Previously uploaded photographs</summary>
                {files
                  .filter(
                    (f) =>
                      !f.withdrawn &&
                      !payload.attachments.some((a) => a.id === f.id),
                  )
                  .map((f) => (
                    <Button
                      key={f.id}
                      type="button"
                      variant="outline"
                      onClick={() =>
                        field("attachments", [
                          ...payload.attachments,
                          { id: f.id, caption: "" },
                        ])
                      }
                    >
                      Attach {f.originalName}
                    </Button>
                  ))}
              </details>
            )}
        </fieldset>
        {editable && (
          <div className="form-actions">
            <span role="status">
              {dirty ? "Unsaved changes" : "Draft saved"}
            </span>
            <Button type="submit" variant="outline" disabled={busy}>
              Save draft
            </Button>
            <Button type="button" disabled={busy} onClick={() => save(true)}>
              Save & send for review
            </Button>
          </div>
        )}
      </form>
      {reviewer && (
        <section className="form-section form-stack">
          <h2>Publication actions</h2>
          <label>
            Decision or withdrawal reason
            <textarea
              rows={3}
              minLength={10}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {revision.state === "pending" &&
            (independent ? (
              <>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  I checked the project information and photographs.
                </label>
                <div className="action-row">
                  <Button
                    disabled={busy || reason.trim().length < 10 || !reviewed}
                    onClick={() => decision("approve")}
                  >
                    Approve & publish
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || reason.trim().length < 10}
                    onClick={() => decision("return")}
                  >
                    Return for correction
                  </Button>
                </div>
              </>
            ) : (
              <p>
                You helped prepare this revision. Another approver must review
                it.
              </p>
            ))}
          {record.publishedRevisionId && !record.withdrawnAt && (
            <Button
              variant="outline"
              disabled={busy || reason.trim().length < 10}
              onClick={() => {
                if (!canLeave()) return;
                void operation(async () => {
                  await contentRequest(
                    "/api/staff/content/" + record.id,
                    "POST",
                    { action: "withdraw", reason },
                  );
                  setBaseline(JSON.stringify(payload));
                  setMessage("Project withdrawn from public access.");
                  router.refresh();
                });
              }}
            >
              Withdraw published project
            </Button>
          )}
        </section>
      )}
      {error && (
        <div role="alert" className="form-error">
          <p>{error}</p>
          <Button variant="outline" onClick={() => setRecovery(true)}>
            Preserve my changes
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (canLeave()) window.location.reload();
            }}
          >
            Reload record
          </Button>
        </div>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {recovery && (
        <label className="form-section">
          Copy of your current edits — select and copy before reloading
          <textarea
            rows={10}
            readOnly
            value={JSON.stringify(payload, null, 2)}
            onFocus={(e) => e.target.select()}
          />
        </label>
      )}
      <section className="detail-section">
        <h2>Private revision history</h2>
        {record.revisions.map((r) => (
          <p key={r.id}>
            Revision {r.number} · {r.state} ·{" "}
            {new Date(r.createdAt).toLocaleDateString("en-GB", {
              timeZone: "UTC",
            })}
            {r.decisionReason ? " · " + r.decisionReason : ""}
          </p>
        ))}
      </section>
    </>
  );
}
