import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  School,
  HeartPulse,
  Users,
  Droplets,
  Shapes,
  MapPin,
  Check,
  MoveUpRight,
} from "lucide-react";
import { statusTone } from "@/lib/projects";
import { publicDataset } from "@/lib/content/showcase";
import { ProjectCard } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pageMetadata } from "@/lib/site";
export const metadata = pageMetadata(
  "Our communities. Our progress.",
  "Follow approved projects, milestones and evidence across Wassa East Constituency.",
  "/",
);
const categoryIcons: Record<string, typeof Shapes> = {
  Education: School,
  Health: HeartPulse,
  "Community Development": Users,
  "Social Amenities": Droplets,
  General: Shapes,
};
export default async function HomePage() {
  const { projects, categories, stats, categoryCounts } = await publicDataset();
  const featured = projects[0];
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <h1>
            Our communities.
            <br />
            <span className="hero-accent">Our progress.</span>
          </h1>
          <p className="hero-description">Track projects across Wassa East.</p>
          <div className="hero-actions">
            <Button asChild>
              <Link href="/projects">
                View projects <ArrowUpRight size={18} />
              </Link>
            </Button>
            <Link className="text-link" href="/about">
              About <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <Image
            priority
            src={featured?.coverUrl ?? "/illustrations/school.svg"}
            unoptimized={!!featured?.coverUrl}
            alt={
              featured?.coverUrl
                ? featured.title
                : "Architectural illustration; not documentary evidence"
            }
            width={760}
            height={600}
            className="hero-image"
          />
          <div className="hero-caption">
            <span>
              <MapPin size={15} /> Wassa East Constituency
            </span>
            <span>
              {featured?.coverUrl
                ? "Approved project photograph"
                : "Architectural illustration"}
            </span>
          </div>
        </div>
      </section>
      <section className="stats-section">
        <div className="container stats-grid">
          {[
            {
              label: "Projects tracked",
              count: stats.total,
              icon: Shapes,
            },
            {
              label: "Ongoing projects",
              count: stats.ongoing,
              icon: MoveUpRight,
            },
            {
              label: "Completed projects",
              count: stats.completed,
              icon: Check,
            },
          ].map(({ label, count, icon: Icon }) => (
            <div className="stat" key={label}>
              <div className="stat-label">
                {label}
                <Icon size={16} />
              </div>
              <div className="stat-number">
                {String(count).padStart(2, "0")}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="container section">
        <div className="section-header">
          <div>
            <h2>Categories</h2>
          </div>
        </div>
        <div className="category-grid">
          {categories.map((category) => {
            const Icon = categoryIcons[category] ?? Shapes;
            return (
              <Link
                href={`/projects?category=${encodeURIComponent(category)}`}
                className="category-card"
                key={category}
              >
                <Icon strokeWidth={1.5} size={26} />
                <span>{category}</span>
                <small>
                  {categoryCounts[category] ?? 0} projects{" "}
                  <ArrowUpRight size={16} />
                </small>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="section section-tinted">
        <div className="container">
          <div className="section-header">
            <div>
              <h2>Featured project</h2>
            </div>
            <Link href="/projects" className="text-link">
              View all projects <ArrowRight size={17} />
            </Link>
          </div>
          {featured ? (
            <div className="featured-project">
              <Link
                href={`/projects/${featured.slug}`}
                className="featured-image"
              >
                <Image
                  src={
                    featured.coverUrl ?? `/illustrations/${featured.image}.svg`
                  }
                  unoptimized={!!featured.coverUrl}
                  alt={
                    featured.coverUrl
                      ? featured.title
                      : "Illustration only; not documentary evidence"
                  }
                  width={960}
                  height={560}
                />
                <span className="image-category">
                  {featured.coverUrl ? "LATEST PROJECT" : "ILLUSTRATION ONLY"}
                </span>
              </Link>
              <div className="featured-copy">
                <div className="card-meta">
                  <span>{featured.category.toUpperCase()}</span>
                  <Badge tone={statusTone(featured.status)}>
                    {featured.status}
                  </Badge>
                </div>
                <h3>{featured.title}</h3>
                <p>{featured.description}</p>
                <span className="location">
                  <MapPin size={15} />
                  {featured.community}, Wassa East
                </span>
                <div className="progress-label">
                  <span>Progress so far</span>
                  <strong>{featured.progress}%</strong>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label="Featured project progress"
                  aria-valuenow={featured.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div style={{ width: `${featured.progress}%` }} />
                </div>
                <Link href={`/projects/${featured.slug}`} className="text-link">
                  See project details <ArrowUpRight size={18} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <School size={36} />
              <h3>No published projects yet.</h3>
            </div>
          )}
        </div>
      </section>
      {projects.length > 1 && (
        <section className="container section">
          <div className="section-header">
            <div>
              <h2>Latest projects</h2>
            </div>
            <Link href="/projects" className="text-link">
              View all projects <ArrowRight size={17} />
            </Link>
          </div>
          <div className="project-grid">
            {projects.slice(1, 4).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}
      <section className="container discover-banner">
        <div>
          <h2>Project map</h2>
          <Button variant="light" asChild>
            <Link href="/projects?view=map">
              Explore project map <Search size={17} />
            </Link>
          </Button>
        </div>
        <div className="map-art" aria-hidden="true">
          <div className="map-road road-one" />
          <div className="map-road road-two" />
          <div className="map-road road-three" />
          <div className="map-pin pin-one">
            <MapPin />
          </div>
          <div className="map-pin pin-two">
            <School />
          </div>
          <div className="map-pin pin-three">
            <HeartPulse />
          </div>
          <span className="map-community">WASSA EAST</span>
        </div>
      </section>
    </>
  );
}
