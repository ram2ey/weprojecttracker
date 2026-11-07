import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { PublicContent } from "@/lib/content/types";
import { statusTone } from "@/lib/projects";
import { siteUrl } from "@/lib/site";
import { sourceParts } from "@/lib/content/source-links";
import { headers } from "next/headers";
export async function PublishedContentView({
  record: r,
}: {
  record: PublicContent;
}) {
  const p = r.payload;
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
            url: siteUrl() + "/projects/" + r.slug,
          }).replace(/</g, "\u003c"),
        }}
      />
      <Link href="/" className="text-link">
        ← All projects
      </Link>
      <div className="detail-title">
        <div>
          <span className="eyebrow">
            {r.code} · {p.categoryName}
          </span>
          <h1>{p.title}</h1>
          <p>{p.communityName} · Wassa East</p>
        </div>
        <Badge tone={statusTone(p.status)}>{p.status}</Badge>
      </div>
      <section className="detail-section">
        <h2>About this project</h2>
        <p className="preserve-lines">{p.description}</p>
      </section>
      {p.status === "Completed" && (
        <section className="detail-section">
          <h2>Completion</h2>
          <p>Completed {p.actualCompletionDate}</p>
          <p className="preserve-lines">{p.completionSummary}</p>
        </section>
      )}
      <section className="detail-section">
        <h2>Photographs</h2>
        {!!p.attachments.length && (
          <p className="subtle-note">
            Select a photograph to view it in full. Use Back to return to this
            project.
          </p>
        )}
        {p.attachments.length ? (
          <div className="photo-gallery">
            {p.attachments.map((a) => (
              <figure key={a.id}>
                <a
                  href={"/api/media/" + a.id}
                  aria-label={"Open full photograph: " + (a.caption || p.title)}
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
            ))}
          </div>
        ) : (
          <p>No photographs have been published yet.</p>
        )}
      </section>
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
        <p className="subtle-note">
          Last approved update:{" "}
          <time dateTime={r.publishedAt}>
            {new Date(r.publishedAt).toLocaleDateString("en-GB", {
              timeZone: "UTC",
            })}
          </time>
        </p>
      </section>
    </div>
  );
}
