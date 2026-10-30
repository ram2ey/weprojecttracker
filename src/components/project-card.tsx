import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Badge } from "./ui/badge";
import { statusTone, type PublicProject } from "@/lib/projects";
export function ProjectCard({ project }: { project: PublicProject }) {
  return (
    <article className="project-card">
      <Link href={`/projects/${project.slug}`} className="project-image-link">
        <Image
          src={project.coverUrl ?? `/illustrations/${project.image}.svg`}
          unoptimized={!!project.coverUrl}
          alt={
            project.coverUrl
              ? project.title
              : `Illustration for ${project.title}; not documentary evidence`
          }
          width={640}
          height={400}
          className="project-image"
        />
        <span className="image-category">{project.category}</span>
        {!project.coverUrl && (
          <span className="illustration-label">Illustration only</span>
        )}
        <span className="image-arrow">
          <ArrowUpRight size={20} />
        </span>
      </Link>
      <div className="project-card-body">
        <div className="card-meta">
          <span>
            <MapPin size={13} /> {project.community}
          </span>
          <Badge tone={statusTone(project.status)}>{project.status}</Badge>
        </div>
        <h3>
          <Link href={`/projects/${project.slug}`}>{project.title}</Link>
        </h3>
        <p>{project.description}</p>
        <div className="progress-label">
          <span>Project progress</span>
          <strong>{project.progress}%</strong>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label={`${project.title} progress`}
          aria-valuenow={project.progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div style={{ width: `${project.progress}%` }} />
        </div>
        <div className="card-bottom">
          <span>Updated {project.updated.replace("2026", "").trim()}</span>
          <span>{project.id}</span>
        </div>
      </div>
    </article>
  );
}
