import Link from "next/link";
import { HeroPhotos } from "@/components/hero-photos";
import { pageMetadata } from "@/lib/site";
export const metadata = pageMetadata(
  "Wassa East Project Tracker",
  "Meet Wassa East and explore the progress of projects in its communities.",
  "/",
);
export default function Home() {
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
              across Wassa East.
            </p>
            <div className="action-row">
              <Link className="button button-light" href="/projects">
                Explore projects
              </Link>
              <Link className="button hero-about" href="/about">
                About Wassa East
              </Link>
            </div>
          </div>
        </div>
      </section>
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
    </>
  );
}
