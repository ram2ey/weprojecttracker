import Link from "next/link";
import {
  Droplets,
  GraduationCap,
  HeartPulse,
  LayoutGrid,
  Users,
  type LucideIcon,
} from "lucide-react";
import { publicCategoryCounts } from "@/lib/content/public";
import { InstallTracker } from "@/components/install-tracker";
import { HeroPhotos } from "@/components/hero-photos";
import { HomeNews } from "@/components/homepage-sections";
import { FaqSection } from "@/components/faq-section";
import { pageMetadata } from "@/lib/site";
export const metadata = pageMetadata(
  "Wassa East Project Tracker",
  "Meet Wassa East and explore the progress of projects in its communities.",
  "/",
);
const categoryIcons: Record<string, LucideIcon> = {
  "category-education": GraduationCap,
  "category-health": HeartPulse,
  "category-general": LayoutGrid,
  "category-community": Users,
  "category-social": Droplets,
};
export default async function Home() {
  const categories = await publicCategoryCounts();
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
              <Link className="button button-light" href="/projects">
                Explore projects
              </Link>
              <InstallTracker placement="hero" />
            </div>
          </div>
        </div>
      </section>
      <section
        className="container section category-directory"
        aria-labelledby="categories-title"
      >
        <h2 id="categories-title">Browse by category</h2>
        <ul className="category-grid">
          {categories.map(({ id, name, count }) => {
            const Icon = categoryIcons[id] ?? LayoutGrid;
            return (
              <li key={id}>
                <Link
                  href={{ pathname: "/projects", query: { category: name } }}
                >
                  <Icon aria-hidden="true" className="category-icon" />
                  <strong>{name}</strong>
                  <span>
                    {count} {count === 1 ? "project" : "projects"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
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
    </>
  );
}
