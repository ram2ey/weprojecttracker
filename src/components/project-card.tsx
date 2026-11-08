import { ProjectResultLink } from "./content/results-navigation";
import Image from "next/image";
import { Badge } from "./ui/badge";
import type { PublicContent } from "@/lib/content/types";
import { statusTone } from "@/lib/projects";
export function ProjectCard({
  project: r,
  resultsHref,
}: {
  project: PublicContent;
  resultsHref: string;
}) {
  const p = r.payload,
    photo = p.attachments[0];
  return (
    <article className="project-card">
      {photo && (
        <ProjectResultLink
          slug={r.slug}
          resultsHref={resultsHref}
          className="project-image-link"
        >
          <Image
            src={"/api/public/thumbnails/" + photo.id}
            alt={photo.caption || p.title}
            width={640}
            height={400}
            unoptimized
            className="project-image"
          />

          <span className="image-category">{p.categoryName}</span>
        </ProjectResultLink>
      )}
      <div className="project-card-body">
        <div className="card-meta">
          <span>
            {!photo && <>{p.categoryName} · </>}
            {p.communityName}
          </span>
          <Badge tone={statusTone(p.status)}>{p.status}</Badge>
        </div>
        <h2>
          <ProjectResultLink slug={r.slug} resultsHref={resultsHref}>
            {p.title}
          </ProjectResultLink>
        </h2>
        <p>
          {p.description.slice(0, 180)}
          {p.description.length > 180 ? "…" : ""}
        </p>
        <div className="card-bottom">
          <time dateTime={r.publishedAt}>
            Updated{" "}
            {new Date(r.publishedAt).toLocaleDateString("en-GB", {
              timeZone: "UTC",
            })}
          </time>
        </div>
      </div>
    </article>
  );
}
