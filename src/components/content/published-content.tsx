import Link from "next/link";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { mediaFile } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { statusTone } from "@/lib/projects";
import type { PublicContent } from "@/lib/content/types";
import { EvidenceGallery } from "@/components/discovery/evidence-gallery";
import { ShareLink } from "@/components/discovery/share-link";
import { siteUrl } from "@/lib/site";
import { GuestDiscussion } from "@/components/engagement/guest-discussion";
import { FollowButton } from "@/components/engagement/follow-button";
const date = (value: string) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        timeZone: "UTC",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Not reported";
export async function PublishedContentView({
  record,
}: {
  record: PublicContent;
}) {
  const p = record.payload;
  const ids = record.history.flatMap((r) =>
    r.payload.attachments.map((a) => a.id),
  );
  const files = ids.length
    ? await getDb()
        .select({ id: mediaFile.id, mimeType: mediaFile.mimeType })
        .from(mediaFile)
        .where(inArray(mediaFile.id, ids))
    : [];
  const mime = new Map(files.map((f) => [f.id, f.mimeType]));
  const project = record.kind === "project";
  const url = `${siteUrl()}/${project ? "projects" : "information"}/${record.slug}`;
  const structured = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: p.title,
    description: p.description,
    dateModified: record.publishedAt,
    url,
    inLanguage: "en",
    ...(p.communityName
      ? {
          spatialCoverage: {
            "@type": "Place",
            name: `${p.communityName}, Wassa East, Ghana`,
            ...(p.latitude !== null && p.longitude !== null
              ? {
                  geo: {
                    "@type": "GeoCoordinates",
                    latitude: p.latitude,
                    longitude: p.longitude,
                  },
                }
              : {}),
          },
        }
      : {}),
  };
  return (
    <div className="container section detail-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
        }}
      />
      <Link className="text-link" href={project ? "/projects" : "/updates"}>
        <ArrowLeft size={16} /> {project ? "All projects" : "All updates"}
      </Link>
      <div className="detail-title">
        <div>
          <span className="eyebrow">
            {record.code} · {project ? p.categoryName : record.kind}
          </span>
          <h1>{p.title}</h1>
          <p>
            {p.communityName}
            {p.communityName ? " · " : ""}Published {date(record.publishedAt)}
          </p>
        </div>
        {project && <Badge tone={statusTone(p.status)}>{p.status}</Badge>}
      </div>
      <ShareLink title={p.title} url={url} />
      {project && (
        <FollowButton recordId={record.id} revisionId={record.revisionId} />
      )}
      <nav className="detail-jump-links" aria-label="On this record">
        <a href="#overview">Overview</a>
        <a href="#evidence">Evidence</a>
        <a href="#publication-history">History</a>
      </nav>
      <div className="detail-layout">
        <div>
          <section className="detail-section" id="overview">
            <h2>{project ? "About this project" : "Overview"}</h2>
            <p className="preserve-lines">{p.description}</p>
            {p.objectives && (
              <>
                <h3>Objectives</h3>
                <p className="preserve-lines">{p.objectives}</p>
              </>
            )}
          </section>
          {project && (
            <section className="detail-section">
              <h2>Reported progress</h2>
              <p className="preserve-lines">{p.progressExplanation}</p>
              {p.delayReason && (
                <>
                  <h3>Reason for {p.status.toLowerCase()}</h3>
                  <p>{p.delayReason}</p>
                </>
              )}
              {p.completionSummary && (
                <>
                  <h3>Completion summary</h3>
                  <p>{p.completionSummary}</p>
                </>
              )}
              {p.nextSteps && (
                <>
                  <h3>Next steps</h3>
                  <p>{p.nextSteps}</p>
                </>
              )}
            </section>
          )}
          {!!p.milestones.length && (
            <section className="detail-section">
              <h2>Milestones</h2>
              {p.milestones.map((m, i) => (
                <div className="timeline-entry" key={i}>
                  <h3>{m.title}</h3>
                  <p>
                    {m.achieved ? "Achieved" : "Planned"} · {date(m.date)}
                  </p>
                  <p>{m.description}</p>
                </div>
              ))}
            </section>
          )}
          <section className="detail-section" id="evidence">
            <h2>Supporting evidence</h2>
            {!p.attachments.length && (
              <p>No public attachments have been published.</p>
            )}
            <EvidenceGallery
              photos={p.attachments.filter((a) =>
                mime.get(a.id)?.startsWith("image/"),
              )}
            />
            <div className="evidence-grid">
              {p.attachments
                .filter((a) => !mime.get(a.id)?.startsWith("image/"))
                .map((a) => (
                  <figure key={a.id}>
                    <a className="text-link" href={`/api/media/${a.id}`}>
                      <FileText size={20} />
                      Download PDF: {a.caption || "Supporting document"}
                    </a>
                    <figcaption>
                      {a.caption}
                      {a.capturedOn && ` · ${date(a.capturedOn)}`}
                    </figcaption>
                  </figure>
                ))}
            </div>
          </section>
          {!!p.videoLinks.length && (
            <section className="detail-section">
              <h2>Video updates</h2>
              {p.videoLinks.map((url, i) => (
                <p key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    Watch video update {i + 1} ↗
                  </a>
                </p>
              ))}
            </section>
          )}
          {!!p.references.length && (
            <section className="detail-section">
              <h2>References</h2>
              {p.references.map((r, i) => (
                <p key={i}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    {r.label} ↗
                  </a>
                </p>
              ))}
            </section>
          )}
          <section className="detail-section" id="publication-history">
            <h2>Publication history</h2>
            <div className="timeline">
              {record.history.map((h) => (
                <details className="timeline-entry" key={h.number}>
                  <summary>
                    Version {h.number} · {date(h.publishedAt)} ·{" "}
                    {h.payload.status}
                    {project ? ` · ${h.payload.progress}%` : ""}
                  </summary>
                  <h3>{h.payload.title}</h3>
                  <p className="preserve-lines">
                    {h.payload.changeSummary || "Initial publication"}
                  </p>
                  <p>{h.payload.description}</p>
                  {project && <p>{h.payload.progressExplanation}</p>}
                  {h.payload.objectives && (
                    <p>
                      <strong>Objectives:</strong> {h.payload.objectives}
                    </p>
                  )}
                  {h.payload.completionSummary && (
                    <p>
                      <strong>Completion:</strong> {h.payload.completionSummary}{" "}
                      · {date(h.payload.actualCompletionDate)}
                    </p>
                  )}
                  {h.payload.delayReason && (
                    <p>
                      <strong>Reason:</strong> {h.payload.delayReason}
                    </p>
                  )}
                  {h.payload.nextSteps && (
                    <p>
                      <strong>Next steps:</strong> {h.payload.nextSteps}
                    </p>
                  )}
                  {!!h.payload.milestones.length && (
                    <ul>
                      {h.payload.milestones.map((m, i) => (
                        <li key={i}>
                          {m.title} · {m.achieved ? "Achieved" : "Planned"} ·{" "}
                          {date(m.date)}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p>
                    <strong>Source:</strong> {h.payload.source} ·{" "}
                    {h.payload.reportingOffice}
                  </p>
                  {h.payload.attachments.map((a) => (
                    <p key={a.id}>
                      <a href={`/api/media/${a.id}`}>
                        {a.caption || "Published evidence"}
                      </a>
                    </p>
                  ))}
                </details>
              ))}
            </div>
          </section>
          {project && <GuestDiscussion recordId={record.id} />}
        </div>
        <aside>
          <div className="detail-panel">
            <span className="eyebrow">
              {project ? "PROJECT AT A GLANCE" : "PUBLICATION DETAILS"}
            </span>
            {project && (
              <>
                <div className="detail-progress">
                  {p.progress}
                  <span>%</span>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label="Project completion"
                  aria-valuenow={p.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div style={{ width: `${p.progress}%` }} />
                </div>
              </>
            )}
            <dl>
              {(project
                ? [
                    ["Community", p.communityName],
                    ["Sector", p.categoryName],
                    ["Subcategory", p.subcategoryName],
                    ["District", p.district],
                    ["Region", p.region],
                    ["Start date", date(p.startDate)],
                    ["Expected completion", date(p.expectedCompletionDate)],
                    ["Actual completion", date(p.actualCompletionDate)],
                  ]
                : []
              )
                .concat([
                  ["Reporting office", p.reportingOffice],
                  ["Responsible organisation", p.responsibleOrganisation],
                  ["Source", p.source],
                  ["Published", date(record.publishedAt)],
                ])
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
            {project && (
              <div className="location-note">
                {p.latitude !== null && p.longitude !== null ? (
                  <>
                    <p>
                      Published coordinates: {p.latitude.toFixed(5)},{" "}
                      {p.longitude.toFixed(5)}
                    </p>
                    <Link
                      className="text-link"
                      href={`/projects?view=map&q=${encodeURIComponent(p.title)}`}
                    >
                      See project on the map →
                    </Link>
                  </>
                ) : (
                  <p>
                    Exact coordinates have not been published. This project
                    remains available in the directory.
                  </p>
                )}
              </div>
            )}
            {!!p.tags.length && (
              <div className="project-tags">
                {p.tags.map((tag) => (
                  <Link
                    href={`/projects?q=${encodeURIComponent(tag)}`}
                    key={tag}
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
            {p.verificationNotes && <p>{p.verificationNotes}</p>}
            <div className="panel-note">
              <ShieldCheck size={18} />
              <span>
                Reviewed by a staff member who did not author this revision.
                Progress is reported by the constituency team.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
