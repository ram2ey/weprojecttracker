import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Clock3, ShieldCheck, FileText } from "lucide-react";
import { publicProjects, statusTone } from "@/lib/projects";
import { Badge } from "@/components/ui/badge";
import { getPublicContent } from "@/lib/content/public";
import { isSampleDataset } from "@/lib/content/showcase";
import { PublishedContentView } from "@/components/content/published-content";
import type { Metadata } from "next";
import { contentMetadata } from "@/lib/site";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const record = await getPublicContent((await params).slug);
  return record?.kind === "project"
    ? contentMetadata(record)
    : { title: "Project", robots: { index: false, follow: false } };
}
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const published = await getPublicContent(slug);
  if (published?.kind === "project")
    return <PublishedContentView record={published} />;
  if (!(await isSampleDataset())) notFound();
  const project = publicProjects().find((p) => p.slug === slug);
  if (!project) notFound();
  return (
    <div className="container section detail-page">
      <Link href="/projects" className="text-link">
        <ArrowLeft size={16} /> All projects
      </Link>
      <div className="detail-title">
        <div>
          <span className="eyebrow">
            {project.category.toUpperCase()} · {project.id}
          </span>
          <h1>{project.title}</h1>
          <span className="location">
            <MapPin size={16} />
            {project.community}, Wassa East
          </span>
        </div>
        <Badge tone={statusTone(project.status)}>{project.status}</Badge>
      </div>
      <div className="detail-layout">
        <div>
          <Image
            className="detail-image"
            src={`/illustrations/${project.image}.svg`}
            alt="Illustration accompanying a sample project, not documentary evidence"
            width={1000}
            height={600}
            priority
          />
          <p className="image-note">
            Illustration only. Approved project photographs will replace this
            placeholder.
          </p>
          <section className="detail-section">
            <span className="eyebrow">THE PURPOSE</span>
            <h2>About this project</h2>
            <p>{project.description}</p>
          </section>
          <section className="detail-section">
            <span className="eyebrow">STEP BY STEP</span>
            <h2>Progress history</h2>
            <div className="timeline">
              <div className="timeline-entry">
                <span className="timeline-dot" />
                <small>{project.updated} · SAMPLE UPDATE</small>
                <h3>Latest reporting stage</h3>
                <p>
                  This design preview shows where the dated progress narrative,
                  evidence, milestones, and next steps will appear.
                </p>
              </div>
              <div className="timeline-entry">
                <span className="timeline-dot" />
                <small>PROJECT REGISTRATION</small>
                <h3>A clear starting point</h3>
                <p>
                  Approved updates will remain available here as the project
                  develops.
                </p>
              </div>
            </div>
          </section>
        </div>
        <aside>
          <div className="detail-panel">
            <span className="eyebrow">PROJECT AT A GLANCE</span>
            <div className="detail-progress">
              {project.progress}
              <span>%</span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Project completion"
              aria-valuenow={project.progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div style={{ width: `${project.progress}%` }} />
            </div>
            <p>
              Reported progress, supported by an explanation and reviewed
              evidence.
            </p>
            <dl>
              <div>
                <dt>Community</dt>
                <dd>{project.community}</dd>
              </div>
              <div>
                <dt>Sector</dt>
                <dd>{project.category}</dd>
              </div>
              <div>
                <dt>Last update</dt>
                <dd>{project.updated}</dd>
              </div>
              <div>
                <dt>Reporting office</dt>
                <dd>To be confirmed</dd>
              </div>
            </dl>
            <div className="panel-note">
              <ShieldCheck size={18} />
              <span>
                Sample record for design review. This is not an official project
                claim.
              </span>
            </div>
          </div>
          <div className="detail-panel secondary-panel">
            <FileText size={22} />
            <h3>Supporting evidence</h3>
            <p>
              Approved photographs and public documents will appear here. No
              sample documents are presented as evidence.
            </p>
          </div>
          <p className="subtle-note">
            <Clock3 size={14} /> Following, comments, and notifications arrive
            in Phase 4.
          </p>
        </aside>
      </div>
    </div>
  );
}
