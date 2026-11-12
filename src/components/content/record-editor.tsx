"use client";
import { flushSync } from "react-dom";
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
import { publicationFieldErrors } from "@/lib/content/validation";
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
    [withdrawalReason, setWithdrawalReason] = useState(""),
    [reviewed, setReviewed] = useState(false),
    // Every approved update alerts by default; reviewers opt out for minor
    // corrections. First publication and status changes always alert.
    [alertFollowers, setAlertFollowers] = useState(true),
    [showIssues, setShowIssues] = useState(false),
    [recovery, setRecovery] = useState(false),
    form = useRef<HTMLFormElement>(null);
  const publishedRevision = record.revisions.find(
    (item) => item.id === record.publishedRevisionId,
  );
  // A withdrawn photograph can leave the live "Completed" version without the
  // photograph that status requires; the public page then shows none.
  const completedWithoutPhoto =
    !!publishedRevision &&
    !record.withdrawnAt &&
    publishedRevision.payload.status === "Completed" &&
    !publishedRevision.payload.attachments.some((a) =>
      record.files.some((f) => f.id === a.id && !f.withdrawn),
    );
  const dirty = JSON.stringify(payload) !== baseline,
    canLeave = useUnsavedChanges(dirty),
    editable = revision.state === "draft" && canSubmit(role),
    reviewer = role !== "officer",
    independent =
      revision.authorId !== actorId &&
      !revision.contributors.includes(actorId) &&
      revision.submittedBy !== actorId;
  const issues = showIssues && editable ? publicationFieldErrors(payload) : {};
  function fieldProps(key: keyof LaunchPayload, hint?: string) {
    return {
      id: "project-" + key,
      "aria-invalid": issues[key] ? true : undefined,
      "aria-describedby": issues[key] ? "error-" + key : hint,
    };
  }
  function fieldError(key: keyof LaunchPayload) {
    return (
      issues[key] && (
        <span className="field-error" id={"error-" + key}>
          {issues[key]}
        </span>
      )
    );
  }
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
    if (submit) {
      const firstIssue = Object.keys(publicationFieldErrors(payload))[0];
      if (firstIssue) {
        flushSync(() => {
          setShowIssues(true);
          setError("");
          setRecovery(false);
          setMessage("");
        });
        document.getElementById("project-" + firstIssue)?.focus();
        return;
      }
    }
    if (!form.current?.reportValidity()) return;
    setShowIssues(false);
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
        action === "approve"
          ? {
              action,
              reason,
              evidenceReviewed: reviewed,
              notifyFollowers: alertFollowers,
              lockVersion,
            }
          : { action, reason, evidenceReviewed: reviewed, lockVersion },
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
      {completedWithoutPhoto && (
        <div className="notice" role="status">
          <p>
            <strong>The published project has no photograph.</strong> It is
            marked Completed, but its photographs have been withdrawn, so the
            public page shows none. Create a new draft, add a current
            photograph and send it for review.
          </p>
        </div>
      )}
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
              {...fieldProps("title")}
              aria-label="Title"
              value={payload.title}
              minLength={3}
              maxLength={160}
              required
              onChange={(e) => field("title", e.target.value)}
            />
            {fieldError("title")}
          </label>
          <label>
            Description
            <textarea
              {...fieldProps("description", "submission-help")}
              aria-label="Description"
              aria-required="true"
              rows={6}
              value={payload.description}
              maxLength={15000}
              onChange={(e) => field("description", e.target.value)}
            />
            {fieldError("description")}
          </label>
          <div className="form-columns">
            <label>
              Category
              <select
                {...fieldProps("categoryId")}
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
              {fieldError("categoryId")}
            </label>
            <label>
              Community
              <select
                {...fieldProps("communityId")}
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
              {fieldError("communityId")}
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
              {...fieldProps("source", "submission-help")}
              aria-label="Information source"
              aria-required="true"
              rows={2}
              maxLength={2000}
              value={payload.source}
              onChange={(e) => field("source", e.target.value)}
            />
            {fieldError("source")}
          </label>
          {payload.status === "Completed" && (
            <div className="form-stack">
              <label>
                Completion date
                <input
                  {...fieldProps("actualCompletionDate")}
                  type="date"
                  aria-required="true"
                  value={payload.actualCompletionDate}
                  onChange={(e) =>
                    field("actualCompletionDate", e.target.value)
                  }
                />
                {fieldError("actualCompletionDate")}
              </label>
              <label>
                Completion summary
                <textarea
                  rows={3}
                  aria-required="true"
                  maxLength={4000}
                  {...fieldProps("completionSummary")}
                  value={payload.completionSummary}
                  onChange={(e) => field("completionSummary", e.target.value)}
                />
                {fieldError("completionSummary")}
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
                {...fieldProps("attachments")}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void upload(f);
                }}
              />
              {fieldError("attachments")}
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
      {reviewer && revision.state === "pending" && (
        <section className="form-section form-stack">
          <h2>Review decision</h2>
          <label>
            Review decision reason
            <textarea
              rows={3}
              aria-describedby="decision-reason-help"
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p id="decision-reason-help" className="subtle-note">
            Optional when approving. To return a revision, enter at least 10
            characters explaining what to correct; leading and trailing spaces
            do not count.
          </p>
          {independent ? (
            <>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                I checked the project information and photographs.
              </label>
              {!publishedRevision ? (
                <p className="subtle-note">
                  Approving publishes this project. People with notifications
                  turned on are alerted automatically.
                </p>
              ) : publishedRevision.payload.status !==
                revision.payload.status ? (
                <p className="subtle-note">
                  The status changes from {publishedRevision.payload.status} to{" "}
                  {revision.payload.status}. People with notifications turned
                  on are alerted automatically.
                </p>
              ) : (
                <>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={alertFollowers}
                      aria-describedby="alert-followers-help"
                      onChange={(e) => setAlertFollowers(e.target.checked)}
                    />
                    Send a notification about this update
                  </label>
                  <p id="alert-followers-help" className="subtle-note">
                    Alerts people with notifications turned on. Untick for small
                    corrections, such as spelling fixes, that do not need an
                    alert.
                  </p>
                </>
              )}
              <div className="action-row">
                <Button
                  disabled={busy || !reviewed}
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
              You helped prepare this revision. Another approver must review it.
            </p>
          )}
        </section>
      )}
      {reviewer && publishedRevision && !record.withdrawnAt && (
        <section className="form-section form-stack">
          <h2>Withdraw publication</h2>
          <p>
            Withdrawal removes “{publishedRevision.payload.title}” from the
            public register.
          </p>
          <label>
            Withdrawal reason
            <textarea
              rows={3}
              value={withdrawalReason}
              maxLength={2000}
              aria-describedby="withdraw-help"
              onChange={(e) => setWithdrawalReason(e.target.value)}
            />
          </label>
          <p className="subtle-note" id="withdraw-help">
            Enter at least 10 characters.
          </p>
          <Button
            variant="outline"
            disabled={busy || withdrawalReason.trim().length < 10}
            onClick={() => {
              if (
                !window.confirm(
                  "Withdraw “" +
                    publishedRevision.payload.title +
                    "” from the public register?",
                )
              )
                return;
              void operation(async () => {
                await contentRequest(
                  "/api/staff/content/" + record.id,
                  "POST",
                  { action: "withdraw", reason: withdrawalReason },
                );
                setWithdrawalReason("");
                setMessage("Project withdrawn from public access.");
                router.refresh();
              });
            }}
          >
            Withdraw published project
          </Button>
        </section>
      )}
      {error && (
        <div role="alert" className="form-error">
          <p>{error}</p>
          {editable && dirty && (
            <>
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
            </>
          )}
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
