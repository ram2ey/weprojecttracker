import Link from "next/link";
import { publicCommunities } from "@/lib/content/public";
import { HeroPhotos } from "@/components/hero-photos";
import { AppDownloads, HomeNews } from "@/components/homepage-sections";
import { FaqSection } from "@/components/faq-section";
import { pageMetadata } from "@/lib/site";
export const metadata = pageMetadata(
  "Wassa East Project Tracker",
  "Meet Wassa East and explore the progress of projects in its communities.",
  "/",
);
export default async function Home() {
  const communities = await publicCommunities();
  const communityLinks = communities.map(({ name, count }) => (
    <li key={name}>
      <Link href={{ pathname: "/projects", query: { community: name } }}>
        <strong>{name}</strong>
        <span>{count} {count === 1 ? "project" : "projects"}</span>
      </Link>
    </li>
  ));
  return (
    <>
      <section className="register-hero" aria-labelledby="register-title">
        <HeroPhotos
          photos={[
            {
              src: "/images/register-hero.webp",
              desktopCrop: "50% 12%",
              mobileCrop: "50% 20%",
            },
            {
              src: "/images/community-gathering.webp",
              desktopCrop: "50% 58%",
              mobileCrop: "35% 48%",
            },
            {
              src: "/images/yellow-building.webp",
              desktopCrop: "50% 55%",
              mobileCrop: "64% 50%",
            },
            {
              src: "/images/school-desks.webp",
              desktopCrop: "50% 52%",
              mobileCrop: "56% 50%",
            },
            {
              src: "/images/red-roof-building.webp",
              desktopCrop: "50% 62%",
              mobileCrop: "64% 54%",
            },
          ]}
        />
        <div className="container register-hero-content">
          <div className="page-heading">
            <h1 id="register-title">Wassa East Project Tracker</h1>
            <p>
              See what’s being built, improved, and completed in communities
              across Wassa East Constituency.
            </p>
            <div className="action-row">
              <a className="button button-light" href="#communities">
                Find my community
              </a>
              <Link className="button hero-about" href="/projects">
                Explore all projects
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section id="communities" className="container section community-directory" aria-labelledby="communities-title">
        <h2 id="communities-title">Browse by community</h2>
        {communityLinks.length ? (
          <ul className="community-grid">{communityLinks.slice(0, 6)}</ul>
        ) : (
          <p>Communities will appear here as projects are published.</p>
        )}
        {communityLinks.length > 6 && (
          <details>
            <summary>All communities</summary>
            <ul className="community-grid">{communityLinks.slice(6)}</ul>
          </details>
        )}
      </section>
      <HomeNews />
      <section
        className="container section narrow"
        aria-labelledby="meet-wassa-east"
      >
        <h2 id="meet-wassa-east">Meet Wassa East</h2>
        <p>
          Wassa East lies in Ghana’s Western Region. Across its farming
          communities, families grow food crops as well as cocoa and oil palm.
        </p>
        <div className="action-row">
          <Link className="text-link" href="/about">
            More about Wassa East
          </Link>
          <Link className="text-link" href="/contact">
            Contact the office
          </Link>
        </div>
      </section>
      <FaqSection topic="tracker" />
      <AppDownloads />
    </>
  );
}
