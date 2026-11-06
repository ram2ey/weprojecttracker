import Link from "next/link";
import Image from "next/image";
import { Badge } from "./ui/badge";
import type { PublicContent } from "@/lib/content/types";
import { statusTone } from "@/lib/projects";
export function ProjectCard({ project: r }: { project: PublicContent }) {
  const p = r.payload,
    photo = p.attachments[0];
  return (
    <article className="project-card">
      <Link href={"/projects/" + r.slug} className="project-image-link">
        {photo ? (
          <Image
            src={"/api/public/thumbnails/" + photo.id}
            alt={photo.caption || p.title}
            width={640}
            height={400}
            unoptimized
            className="project-image"
          />
        ) : (
          <span className="photo-placeholder">No photograph published yet</span>
        )}
        <span className="image-category">{p.categoryName}</span>
      </Link>
      <div className="project-card-body">
        <div className="card-meta">
          <span>{p.communityName}</span>
          <Badge tone={statusTone(p.status)}>{p.status}</Badge>
        </div>
        <h2>
          <Link href={"/projects/" + r.slug}>{p.title}</Link>
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
          <span>{r.code}</span>
        </div>
      </div>
    </article>
  );
}
