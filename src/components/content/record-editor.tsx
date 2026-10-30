"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Plus,
  Trash2,
  FileText,
  ShieldCheck,
  Upload,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { canSubmit, type Role } from "@/lib/security/policy";
import {
  projectStatuses,
  type AdminRecord,
  type ContentPayload,
  type Financials,
  type Taxonomy,
  type AdminFile,
} from "@/lib/content/types";
import { contentRequest, errorMessage } from "./client-api";

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
  const router = useRouter();
  const revision =
    record.revisions.find((r) => r.id === revisionId) ?? record.revisions[0];
  const [payload, setPayload] = useState<ContentPayload>(revision.payload);
  const [tagsText, setTagsText] = useState(revision.payload.tags.join(", "));
  const [videosText, setVideosText] = useState(
    revision.payload.videoLinks.join("\n"),
  );
  const [financials, setFinancials] = useState<Financials>(revision.financials);
  const [lockVersion, setLockVersion] = useState(revision.lockVersion);
  const [files, setFiles] = useState<AdminFile[]>(record.files);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const editable = revision.state === "draft" && canSubmit(role);
  const reviewer = role === "approver" || role === "super_admin";
  const independent =
    !revision.contributors.includes(actorId) &&
    revision.submittedBy !== actorId;
  const previous = record.revisions.find(
    (r) => r.id === record.publishedRevisionId,
  );
  const publicUrl =
    record.kind === "project"
      ? `/projects/${record.slug}`
      : `/information/${record.slug}`;
  function field<K extends keyof ContentPayload>(
    key: K,
    value: ContentPayload[K],
  ) {
    setPayload((current) => ({ ...current, [key]: value }));
  }
  async function save(submit: boolean) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await contentRequest<{ lockVersion: number }>(
        `/api/staff/content/${record.id}/revisions/${revision.id}`,
        "PATCH",
        {
          payload: {
            ...payload,
            tags: tagsText
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            videoLinks: videosText
              .split("\n")
              .map((v) => v.trim())
              .filter(Boolean),
          },
          financials,
          lockVersion,
        },
      );
      setLockVersion(result.lockVersion);
      if (submit) {
        await contentRequest(
          `/api/staff/content/${record.id}/revisions/${revision.id}`,
          "POST",
          { action: "submit", lockVersion: result.lockVersion },
        );
        setLockVersion(result.lockVersion + 1);
        setMessage(
          "Submitted for independent review. The last approved version remains public.",
        );
      } else setMessage("Draft saved privately.");
      router.refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function decision(action: "approve" | "return" | "reject") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await contentRequest(
        `/api/staff/content/${record.id}/revisions/${revision.id}`,
        "POST",
        { action, reason, evidenceReviewed: reviewed, lockVersion },
      );
      setMessage(
        action === "approve"
          ? "Approved and published. Public pages now show this revision."
          : action === "return"
            ? "Returned for correction. The officer can create a new draft."
            : "Rejected with the recorded reason.",
      );
      router.refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function recordAction(action: "revise" | "withdraw" | "discard") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await contentRequest<{
        recordId?: string;
        revisionId?: string;
      }>(`/api/staff/content/${record.id}`, "POST", {
        action,
        sourceRevisionId: action === "revise" ? revision.id : undefined,
        revisionId: action === "discard" ? revision.id : undefined,
        lockVersion,
        reason,
      });
      if (result.revisionId)
        router.push(
          `/admin/content/${record.id}?revision=${result.revisionId}`,
        );
      else {
        setMessage(
          action === "withdraw"
            ? "Withdrawn from the public platform. The decision is recorded in the audit trail."
            : "Draft discarded. Its saved history is retained.",
        );
        router.refresh();
      }
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File, internalOnly: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData();
    form.append("file", file);
    form.append("internalOnly", String(internalOnly));
    try {
      const response = await fetch(`/api/staff/content/${record.id}/media`, {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      const item = result as AdminFile;
      setFiles((old) => [...old, item]);
      field("attachments", [
        ...payload.attachments,
        {
          id: item.id,
          caption: "",
          capturedOn: "",
          visibility:
            item.internalOnly || item.mimeType === "application/pdf"
              ? "internal"
              : "public",
          purpose: item.internalOnly ? "financial" : "evidence",
        },
      ]);
      setMessage(
        "Uploaded privately. Save the draft to attach this evidence; it is public only after approval.",
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(false);
  }
  const currentTerms = (kind: Taxonomy["kind"]) =>
    terms.filter(
      (t) =>
        t.kind === kind &&
        (t.active ||
          [
            payload.categoryId,
            payload.subcategoryId,
            payload.communityId,
          ].includes(t.id)),
    );
  return (
    <>
      <Link href="/admin?view=projects" className="text-link">
        <ArrowLeft size={15} />
        Back to the register
      </Link>
      <div className="console-heading">
        <div>
          <span className="eyebrow">
            {record.code} · {record.kind.toUpperCase()} · REVISION{" "}
            {revision.number}
          </span>
          <h1>{payload.title}</h1>
          <p>
            {record.withdrawnAt
              ? "This record is withdrawn. A fresh, independently approved revision is required to republish."
              : record.publishedRevisionId
                ? "An approved version exists. Draft and pending changes remain private."
                : "This record has not been published."}
          </p>
        </div>
        <Badge
          tone={
            revision.state === "pending"
              ? "amber"
              : revision.state === "approved"
                ? "green"
                : "neutral"
          }
        >
          {revision.state}
        </Badge>
      </div>
      <div className="revision-toolbar">
        <label>
          Revision history
          <select
            aria-label="Revision history"
            value={revision.id}
            onChange={(event) =>
              router.push(
                `/admin/content/${record.id}?revision=${event.target.value}`,
              )
            }
          >
            {record.revisions.map((r) => (
              <option key={r.id} value={r.id}>
                Revision {r.number} · {r.state}
                {r.id === record.publishedRevisionId ? " · last published" : ""}
              </option>
            ))}
          </select>
        </label>
        {record.publishedRevisionId && !record.withdrawnAt && (
          <Link
            href={publicUrl}
            className="text-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            View published version <ExternalLink size={15} />
          </Link>
        )}
        {canSubmit(role) &&
          !record.revisions.some(
            (r) => r.state === "draft" || r.state === "pending",
          ) && (
            <Button onClick={() => recordAction("revise")} disabled={busy}>
              <Plus size={16} />
              Create a new draft
            </Button>
          )}
      </div>
      {revision.decisionReason && (
        <p className="notice">
          <strong>Recorded decision:</strong> {revision.decisionReason}
        </p>
      )}
      {previous && previous.id !== revision.id && (
        <details className="comparison-panel">
          <summary>Compare with the last approved version</summary>
          <div className="comparison-grid">
            {(
              [
                "title",
                "description",
                "status",
                "progress",
                "expectedCompletionDate",
                "completionSummary",
              ] as const
            )
              .filter((key) => previous.payload[key] !== payload[key])
              .map((key) => (
                <div key={key}>
                  <strong>{key.replace(/([A-Z])/g, " $1")}</strong>
                  <span>
                    <small>Published</small>
                    {String(previous.payload[key]) || "Not supplied"}
                  </span>
                  <span>
                    <small>This revision</small>
                    {String(payload[key]) || "Not supplied"}
                  </span>
                </div>
              ))}
            <p>
              Review all fields and attachments below. Internal financial
              information is excluded from public pages.
            </p>
          </div>
        </details>
      )}
      <form onSubmit={onSubmit} className="record-editor">
        <fieldset disabled={!editable || busy} className="editor-fields">
          <section className="form-section">
            <div className="form-section-heading">
              <span>01</span>
              <div>
                <h2>Details</h2>
              </div>
            </div>
            <div className="form-stack">
              <label>
                Title
                <input
                  value={payload.title}
                  onChange={(e) => field("title", e.target.value)}
                  minLength={3}
                  maxLength={160}
                  required
                />
              </label>
              <label>
                {record.kind === "project"
                  ? "Description"
                  : "Announcement or report introduction"}
                <textarea
                  rows={5}
                  value={payload.description}
                  onChange={(e) => field("description", e.target.value)}
                  maxLength={15000}
                />
              </label>
              {record.kind === "project" && (
                <>
                  <label>
                    Objectives
                    <textarea
                      rows={3}
                      value={payload.objectives}
                      onChange={(e) => field("objectives", e.target.value)}
                    />
                  </label>
                  <div className="form-columns">
                    <label>
                      Category
                      <select
                        aria-label="Category"
                        value={payload.categoryId}
                        onChange={(e) => {
                          field("categoryId", e.target.value);
                          field("subcategoryId", "");
                        }}
                      >
                        <option value="">Choose a category</option>
                        {currentTerms("category").map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                            {!t.active ? " (retired)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Subcategory
                      <select
                        aria-label="Subcategory"
                        value={payload.subcategoryId}
                        onChange={(e) => field("subcategoryId", e.target.value)}
                      >
                        <option value="">No subcategory</option>
                        {currentTerms("subcategory")
                          .filter((t) => t.parentId === payload.categoryId)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                </>
              )}
              <div className="form-columns">
                <label>
                  Information source
                  <input
                    value={payload.source}
                    onChange={(e) => field("source", e.target.value)}
                  />
                </label>
                <label>
                  Authorised reporting office
                  <input
                    value={payload.reportingOffice}
                    onChange={(e) => field("reportingOffice", e.target.value)}
                  />
                </label>
              </div>
              <label>
                Responsible organisation, where verified
                <input
                  value={payload.responsibleOrganisation}
                  onChange={(e) =>
                    field("responsibleOrganisation", e.target.value)
                  }
                />
              </label>
              <label>
                Public verification notes
                <textarea
                  rows={2}
                  value={payload.verificationNotes}
                  onChange={(e) => field("verificationNotes", e.target.value)}
                />
              </label>
              <label>
                Tags, separated by commas
                <input
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                />
              </label>
            </div>
          </section>
          {record.kind === "project" && (
            <>
              <section className="form-section">
                <div className="form-section-heading">
                  <span>02</span>
                  <div>
                    <h2>Place & progress</h2>
                    <p>Add the location and evidence for reported progress.</p>
                  </div>
                </div>
                <div className="form-columns">
                  <label>
                    Community
                    <select
                      aria-label="Community"
                      value={payload.communityId}
                      onChange={(e) => field("communityId", e.target.value)}
                    >
                      <option value="">Choose a community</option>
                      {currentTerms("community").map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Region
                    <input
                      value={payload.region}
                      onChange={(e) => field("region", e.target.value)}
                    />
                  </label>
                  <label>
                    District
                    <input
                      value={payload.district}
                      onChange={(e) => field("district", e.target.value)}
                    />
                  </label>
                  <label>
                    Constituency
                    <input value="Wassa East" readOnly />
                  </label>
                  <label>
                    Latitude
                    <input
                      type="number"
                      step="any"
                      min={-90}
                      max={90}
                      value={payload.latitude ?? ""}
                      onChange={(e) =>
                        field(
                          "latitude",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    Longitude
                    <input
                      type="number"
                      step="any"
                      min={-180}
                      max={180}
                      value={payload.longitude ?? ""}
                      onChange={(e) =>
                        field(
                          "longitude",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    Project status
                    <select
                      aria-label="Project status"
                      value={payload.status}
                      onChange={(e) =>
                        field(
                          "status",
                          e.target.value as ContentPayload["status"],
                        )
                      }
                    >
                      {projectStatuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Progress (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={payload.progress}
                      onChange={(e) =>
                        field("progress", Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    Start date
                    <input
                      type="date"
                      value={payload.startDate}
                      onChange={(e) => field("startDate", e.target.value)}
                    />
                  </label>
                  <label>
                    Expected completion date
                    <input
                      type="date"
                      value={payload.expectedCompletionDate}
                      onChange={(e) =>
                        field("expectedCompletionDate", e.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="form-stack top-space">
                  <label>
                    How is progress measured?
                    <textarea
                      rows={3}
                      value={payload.progressExplanation}
                      onChange={(e) =>
                        field("progressExplanation", e.target.value)
                      }
                    />
                  </label>
                  {["Delayed", "Suspended", "Cancelled"].includes(
                    payload.status,
                  ) && (
                    <label>
                      Reason for delay, suspension, or cancellation
                      <textarea
                        rows={3}
                        value={payload.delayReason}
                        onChange={(e) => field("delayReason", e.target.value)}
                      />
                    </label>
                  )}
                  <label>
                    Expected next steps
                    <textarea
                      rows={2}
                      value={payload.nextSteps}
                      onChange={(e) => field("nextSteps", e.target.value)}
                    />
                  </label>
                  {payload.status === "Completed" && (
                    <>
                      <label>
                        Actual completion date
                        <input
                          type="date"
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
                          value={payload.completionSummary}
                          onChange={(e) =>
                            field("completionSummary", e.target.value)
                          }
                        />
                      </label>
                      <p className="notice">
                        Completion needs 100% progress, a date, a summary,
                        evidence, and independent approval.
                      </p>
                    </>
                  )}
                </div>
              </section>
              <section className="form-section">
                <div className="form-section-heading">
                  <span>03</span>
                  <div>
                    <h2>Milestones</h2>
                    <p>Track achievements separately from reported progress.</p>
                  </div>
                </div>
                {payload.milestones.map((milestone, index) => (
                  <div className="repeater-row" key={index}>
                    <div className="form-columns">
                      <label>
                        Milestone {index + 1} title
                        <input
                          value={milestone.title}
                          onChange={(e) =>
                            field(
                              "milestones",
                              payload.milestones.map((m, i) =>
                                i === index
                                  ? { ...m, title: e.target.value }
                                  : m,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Milestone {index + 1} date
                        <input
                          type="date"
                          value={milestone.date}
                          onChange={(e) =>
                            field(
                              "milestones",
                              payload.milestones.map((m, i) =>
                                i === index
                                  ? { ...m, date: e.target.value }
                                  : m,
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                    <label>
                      Milestone {index + 1} details
                      <textarea
                        rows={2}
                        value={milestone.description}
                        onChange={(e) =>
                          field(
                            "milestones",
                            payload.milestones.map((m, i) =>
                              i === index
                                ? { ...m, description: e.target.value }
                                : m,
                            ),
                          )
                        }
                      />
                    </label>
                    <div className="action-row">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={milestone.achieved}
                          onChange={(e) =>
                            field(
                              "milestones",
                              payload.milestones.map((m, i) =>
                                i === index
                                  ? { ...m, achieved: e.target.checked }
                                  : m,
                              ),
                            )
                          }
                        />
                        Achieved
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          field(
                            "milestones",
                            payload.milestones.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 size={14} />
                        Remove milestone
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    field("milestones", [
                      ...payload.milestones,
                      { title: "", description: "", date: "", achieved: false },
                    ])
                  }
                  disabled={payload.milestones.length >= 50}
                >
                  <Plus size={15} />
                  Add milestone
                </Button>
              </section>
            </>
          )}
          <section className="form-section">
            <div className="form-section-heading">
              <span>
                <FileText size={16} />
              </span>
              <div>
                <h2>Evidence & references</h2>
                <p>
                  Uploads stay private until attached to an approved revision.
                  Financial documents stay internal.
                </p>
              </div>
            </div>
            {editable && (
              <div className="upload-actions">
                <label className="upload-control">
                  <Upload size={20} />
                  Add image or PDF
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload(file, false);
                      event.target.value = "";
                    }}
                  />
                </label>
                <label className="upload-control internal-upload">
                  <ShieldCheck size={20} />
                  Add internal financial document
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload(file, true);
                      event.target.value = "";
                    }}
                  />
                </label>
                <p>
                  Images up to 10 MB; PDFs up to 20 MB. Images are optimised and
                  their location metadata is removed.
                </p>
              </div>
            )}
            {!payload.attachments.length && (
              <p className="subtle-note">
                No evidence attached to this revision.
              </p>
            )}
            {payload.attachments.map((reference, index) => {
              const file = files.find((f) => f.id === reference.id);
              return (
                <div className="attachment-row" key={reference.id}>
                  {file?.mimeType.startsWith("image/") ? (
                    <Image
                      src={`/api/media/${reference.id}?variant=thumbnail`}
                      alt={reference.caption || "Uploaded project evidence"}
                      width={150}
                      height={110}
                      unoptimized
                    />
                  ) : (
                    <span className="document-icon">
                      <FileText size={30} />
                    </span>
                  )}
                  <div className="attachment-fields">
                    <Link
                      href={`/api/media/${reference.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-link"
                    >
                      {file?.originalName ?? "Evidence attachment"}
                      <ExternalLink size={14} />
                    </Link>
                    <label>
                      Attachment {index + 1} caption
                      <input
                        value={reference.caption}
                        onChange={(e) =>
                          field(
                            "attachments",
                            payload.attachments.map((a, i) =>
                              i === index
                                ? { ...a, caption: e.target.value }
                                : a,
                            ),
                          )
                        }
                      />
                    </label>
                    <div className="form-columns">
                      <label>
                        Attachment {index + 1} date
                        <input
                          type="date"
                          value={reference.capturedOn}
                          onChange={(e) =>
                            field(
                              "attachments",
                              payload.attachments.map((a, i) =>
                                i === index
                                  ? { ...a, capturedOn: e.target.value }
                                  : a,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Attachment {index + 1} visibility
                        <select
                          aria-label={`Attachment ${index + 1} visibility`}
                          value={reference.visibility}
                          disabled={
                            !editable ||
                            busy ||
                            file?.internalOnly ||
                            reference.purpose === "financial"
                          }
                          onChange={(e) =>
                            field(
                              "attachments",
                              payload.attachments.map((a, i) =>
                                i === index
                                  ? {
                                      ...a,
                                      visibility: e.target.value as
                                        "public" | "internal",
                                    }
                                  : a,
                              ),
                            )
                          }
                        >
                          <option value="internal">Internal staff only</option>
                          <option value="public">Public after approval</option>
                        </select>
                      </label>
                    </div>
                    {(file?.internalOnly ||
                      reference.purpose === "financial") && (
                      <span className="internal-label">
                        Financial attachment · always internal
                      </span>
                    )}
                    {file?.withdrawn && (
                      <p className="form-error">
                        This attachment has been withdrawn. Remove it from a new
                        draft before submission.
                      </p>
                    )}
                    {editable && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          field(
                            "attachments",
                            payload.attachments.filter(
                              (a) => a.id !== reference.id,
                            ),
                          )
                        }
                      >
                        <Trash2 size={14} />
                        Remove from this draft
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {editable &&
              files.some(
                (f) =>
                  !f.withdrawn &&
                  !payload.attachments.some((a) => a.id === f.id),
              ) && (
                <details className="available-evidence">
                  <summary>Attach another previously uploaded file</summary>
                  {files
                    .filter(
                      (f) =>
                        !f.withdrawn &&
                        !payload.attachments.some((a) => a.id === f.id),
                    )
                    .map((file) => (
                      <Button
                        type="button"
                        key={file.id}
                        variant="ghost"
                        onClick={() =>
                          field("attachments", [
                            ...payload.attachments,
                            {
                              id: file.id,
                              caption: "",
                              capturedOn: "",
                              visibility: "internal",
                              purpose: file.internalOnly
                                ? "financial"
                                : "evidence",
                            },
                          ])
                        }
                      >
                        <Plus size={14} />
                        {file.originalName}
                      </Button>
                    ))}
                </details>
              )}
            <div className="form-stack top-space">
              <label>
                Approved video links, one per line
                <textarea
                  rows={2}
                  value={videosText}
                  placeholder="https://www.youtube.com/watch?v=…"
                  onChange={(e) => setVideosText(e.target.value)}
                />
              </label>
            </div>
            {payload.references.map((reference, index) => (
              <div className="repeater-row" key={index}>
                <div className="form-columns">
                  <label>
                    Reference {index + 1} label
                    <input
                      value={reference.label}
                      onChange={(e) =>
                        field(
                          "references",
                          payload.references.map((r, i) =>
                            i === index ? { ...r, label: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Reference {index + 1} URL
                    <input
                      type="url"
                      value={reference.url}
                      onChange={(e) =>
                        field(
                          "references",
                          payload.references.map((r, i) =>
                            i === index ? { ...r, url: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    field(
                      "references",
                      payload.references.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove reference
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="top-space"
              disabled={payload.references.length >= 20}
              onClick={() =>
                field("references", [
                  ...payload.references,
                  { label: "", url: "" },
                ])
              }
            >
              <Plus size={14} />
              Add public reference
            </Button>
          </section>
          <section className="form-section internal-section">
            <div className="form-section-heading">
              <span>
                <ShieldCheck size={16} />
              </span>
              <div>
                <h2>Internal financial information</h2>
                <p>
                  These fields are visible to verified staff only and are
                  excluded from every public response.
                </p>
              </div>
            </div>
            <div className="form-columns">
              <label>
                Approved budget (GHS)
                <input
                  inputMode="decimal"
                  value={financials.budget}
                  onChange={(e) =>
                    setFinancials((f) => ({ ...f, budget: e.target.value }))
                  }
                />
              </label>
              <label>
                Verified expenditure (GHS)
                <input
                  inputMode="decimal"
                  value={financials.expenditure}
                  onChange={(e) =>
                    setFinancials((f) => ({
                      ...f,
                      expenditure: e.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="form-stack top-space">
              <label>
                Verified funding source
                <input
                  value={financials.fundingSource}
                  onChange={(e) =>
                    setFinancials((f) => ({
                      ...f,
                      fundingSource: e.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Internal notes
                <textarea
                  rows={3}
                  value={financials.internalNotes}
                  onChange={(e) =>
                    setFinancials((f) => ({
                      ...f,
                      internalNotes: e.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </section>
          {record.publishedRevisionId && (
            <section className="form-section">
              <label>
                What changed since the last publication?
                <textarea
                  rows={3}
                  value={payload.changeSummary}
                  onChange={(e) => field("changeSummary", e.target.value)}
                />
              </label>
            </section>
          )}
        </fieldset>
        {editable && (
          <div className="form-actions">
            <p>
              Last saved{" "}
              {new Date(revision.updatedAt).toLocaleString("en-GB", {
                timeZone: "UTC",
              })}{" "}
              UTC
            </p>
            <Button type="submit" variant="outline" disabled={busy}>
              <Save size={15} />
              Save draft
            </Button>
            <Button type="button" disabled={busy} onClick={() => save(true)}>
              Save & send for review
              <ArrowRight size={15} />
            </Button>
          </div>
        )}
      </form>
      {revision.state === "pending" && !independent && reviewer && (
        <p className="notice">
          You helped prepare this revision. Another approver must review it.
        </p>
      )}
      {(reviewer || editable) && (
        <section className="form-section review-actions">
          <h2>
            {revision.state === "pending" && reviewer
              ? "Review this submission"
              : "Record actions"}
          </h2>
          <p className="subtle-note">
            Every decision and withdrawal requires a reason. Submitted and
            approved revisions cannot be edited.
          </p>
          <label className="top-space">
            Review or withdrawal reason
            <textarea
              rows={3}
              value={reason}
              minLength={10}
              maxLength={2000}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Record the checks performed or explain the corrections needed."
            />
          </label>
          {reviewer && revision.state === "pending" && independent && (
            <>
              <label className="checkbox-label top-space">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                I checked the attribution, completion details, and public
                evidence. No internal financial information is being disclosed.
              </label>
              <div className="action-row top-space">
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
                <Button
                  variant="outline"
                  disabled={busy || reason.trim().length < 10}
                  onClick={() => decision("reject")}
                >
                  Reject submission
                </Button>
              </div>
            </>
          )}
          {reviewer && record.publishedRevisionId && !record.withdrawnAt && (
            <Button
              className="top-space"
              variant="outline"
              disabled={busy || reason.trim().length < 10}
              onClick={() => recordAction("withdraw")}
            >
              Withdraw published record
            </Button>
          )}
          {editable && (
            <Button
              className="top-space"
              variant="ghost"
              disabled={busy || reason.trim().length < 10}
              onClick={() => recordAction("discard")}
            >
              Discard this private draft
            </Button>
          )}
          {reviewer && revision.payload.attachments.length > 0 && (
            <details className="top-space">
              <summary>
                Withdraw an attachment from every public revision
              </summary>
              <p className="subtle-note">
                Use the reason above. This immediately blocks public access and
                requires pending changes to be prepared again.
              </p>
              {revision.payload.attachments
                .filter(
                  (a) => !record.files.find((f) => f.id === a.id)?.withdrawn,
                )
                .map((a) => (
                  <Button
                    key={a.id}
                    type="button"
                    variant="ghost"
                    disabled={busy || reason.trim().length < 10}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await contentRequest(
                          `/api/media/${a.id}/withdraw`,
                          "POST",
                          { reason },
                        );
                        setMessage(
                          "Attachment withdrawn and public access blocked.",
                        );
                        router.refresh();
                      } catch (failure) {
                        setError(errorMessage(failure));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Withdraw{" "}
                    {record.files.find((f) => f.id === a.id)?.originalName ??
                      "attachment"}
                  </Button>
                ))}
            </details>
          )}
        </section>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
          <button
            className="text-link"
            type="button"
            onClick={() => window.location.reload()}
          >
            Reload this record
          </button>
        </div>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <section className="record-history">
        <h2>Revision history</h2>
        {record.revisions.map((r) => (
          <Link
            key={r.id}
            href={`/admin/content/${record.id}?revision=${r.id}`}
          >
            <strong>
              Revision {r.number} · {r.state}
            </strong>
            <span>
              {new Date(r.createdAt).toLocaleString("en-GB", {
                timeZone: "UTC",
              })}{" "}
              UTC · {r.contributors.length} contributor
              {r.contributors.length === 1 ? "" : "s"}
            </span>
            {r.decisionReason && <small>{r.decisionReason}</small>}
          </Link>
        ))}
      </section>
    </>
  );
}
