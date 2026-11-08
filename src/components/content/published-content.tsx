import { officeCall, officePhone, officeWhatsApp } from "@/lib/office-contact";
import { RegisterReturnLink } from "./results-navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { PublicContent } from "@/lib/content/types";
import { statusTone } from "@/lib/projects";
import { siteUrl } from "@/lib/site";
import { sourceParts } from "@/lib/content/source-links";
import { headers } from "next/headers";
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}
export async function PublishedContentView({
  record: r,
}: {
  record: PublicContent;
}) {
  const p = r.payload;
  const publicUrl = siteUrl() + "/projects/" + r.slug;
  const [lead, ...remaining] = p.attachments;
  const intro =
    p.description.length > 420
      ? p.description.slice(0, 420).replace(/\s+\S*$/, "")
      : p.description;
  function renderPhoto(a: typeof lead) {
    return (
      <figure key={a.id}>
        <a
          href={"/api/media/" + a.id}
          aria-label={"Open full image: " + (a.caption || p.title)}
        >
          <Image
            src={"/api/public/thumbnails/" + a.id}
            alt={a.caption || p.title}
            width={640}
            height={480}
            unoptimized
          />
        </a>
        {a.caption && <figcaption>{a.caption}</figcaption>}
      </figure>
    );
  }
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <div className="container section detail-page">
      <script
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            name: p.title,
            description: p.description,
            dateModified: r.publishedAt,
            url: publicUrl,
          }).replace(/</g, "\u003c"),
        }}
      />
      <RegisterReturnLink slug={r.slug} />
      <div className="detail-title">
        <div>
          <span className="eyebrow">{p.categoryName}</span>
          <h1>{p.title}</h1>
          <p>{p.communityName} · Wassa East</p>
        </div>
        <Badge tone={statusTone(p.status)}>{p.status}</Badge>
      </div>
      <section className="detail-section">
        <h2>About this project</h2>
        <p className="preserve-lines">{intro}</p>
        {intro.length < p.description.length && (
          <details>
            <summary>Read full description</summary>
            <p className="preserve-lines">
              {p.description.slice(intro.length).trimStart()}
            </p>
          </details>
        )}
        {p.status === "Completed" && (
          <>
            <p>
              <strong>Completed</strong>{" "}
              <time dateTime={p.actualCompletionDate}>
                {formatDate(p.actualCompletionDate)}
              </time>
            </p>
            {p.completionSummary && (
              <p className="preserve-lines">{p.completionSummary}</p>
            )}
          </>
        )}
        <p className="subtle-note">
          Last approved update:{" "}
          <time dateTime={r.publishedAt}>{formatDate(r.publishedAt)}</time>
        </p>
      </section>
      {lead && (
        <section className="detail-section">
          <h2>Images</h2>
          <div className="photo-gallery">{renderPhoto(lead)}</div>
          {!!remaining.length && (
            <details className="more-photos">
              <summary>View all {p.attachments.length} photos</summary>
              <div className="photo-gallery">{remaining.map(renderPhoto)}</div>
            </details>
          )}
        </section>
      )}
      <section className="detail-section">
        <h2>Information source</h2>
        <p className="preserve-lines source-text">
          {sourceParts(p.source).map((part, i) =>
            part.href ? (
              <a
                key={i}
                href={part.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {part.text}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              part.text
            ),
          )}
        </p>
        <h3>Ask the office about this project</h3>
        <div className="action-row">
          <a
            className="text-link"
            href={
              officeWhatsApp +
              "?text=" +
              encodeURIComponent(
                "Hello, I have a question about " + p.title + ". " + publicUrl,
              )
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            Ask on WhatsApp
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a className="text-link" href={officeCall}>
            Call {officePhone}
          </a>
        </div>
      </section>
    </div>
  );
}
