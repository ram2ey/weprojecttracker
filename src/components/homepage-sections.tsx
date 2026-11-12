import { Play, Smartphone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { publishedNews } from "@/lib/news/service";
import { isDesignPreview } from "@/lib/env";
import { storeListing } from "@/lib/store-listing";
import { sampleStories } from "@/lib/news/samples";

export async function HomeNews() {
  const published = await publishedNews();
  const sample = !published.length && isDesignPreview();
  const stories = sample ? sampleStories : published;
  const dateFormat = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  });
  return (
    <section className="home-news" aria-labelledby="news-title">
      <div className="container section">
        <h2 id="news-title">News &amp; Features</h2>
        <div className="home-news-grid">
          {!stories.length && (
            <p>Updates will appear here as they are published.</p>
          )}
          {stories.map((story) => (
            <article key={story.id}>
              {story.photo && (
                <Image
                  className="news-photo"
                  src={story.photo}
                  alt={story.caption}
                  width={640}
                  height={480}
                  loading="lazy"
                  unoptimized
                />
              )}
              <div className="story-meta">
                <span>
                  {sample ? "Sample " + story.kind.toLowerCase() : story.kind}
                </span>
                <time dateTime={story.date}>
                  {dateFormat.format(new Date(story.date))}
                </time>
              </div>
              <h3>{story.title}</h3>
              <p>{story.summary}</p>
              <Link
                className="text-link"
                href={"/news/" + story.id}
                aria-label={"Read more about " + story.title}
              >
                Read more
              </Link>
              {story.project && (
                <Link className="text-link" href={"/projects/" + story.project}>
                  View project
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AppDownloads() {
  const google = storeListing("google", process.env.GOOGLE_PLAY_URL);
  const apple = storeListing("apple", process.env.APP_STORE_URL);
  const GoogleBadge = google ? "a" : "span",
    AppleBadge = apple ? "a" : "span";
  return (
    <section className="mobile-app-section" aria-labelledby="mobile-app-title">
      <div className="container app-download-layout">
        <div>
          <h2 id="mobile-app-title">
            Download the Wassa East Project Tracker app
          </h2>
          <p>
            {google && apple
              ? "Available for Android and iOS."
              : google
                ? "Available for Android. iOS coming soon."
                : apple
                  ? "Available for iOS. Android coming soon."
                  : "Coming to Android and iOS."}
          </p>
        </div>
        <div className="store-badges">
          <GoogleBadge className="store-badge" href={google}>
            <Play aria-hidden="true" fill="currentColor" />
            <span>
              <small>Get it on</small>Google Play
            </span>
          </GoogleBadge>
          <AppleBadge className="store-badge" href={apple}>
            <Smartphone aria-hidden="true" />
            <span>
              <small>Download on the</small>App Store
            </span>
          </AppleBadge>
        </div>
      </div>
    </section>
  );
}
