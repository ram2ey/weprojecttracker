import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicStory, moreNews } from "@/lib/news/service";
import { PublicComments } from "@/components/comments/public-comments";
import { pageMetadata } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const story = await getPublicStory(id);
  if (!story) notFound();
  const metadata = pageMetadata(story.title, story.summary, "/news/" + id);
  // Link previews (WhatsApp, Facebook, X) show the story's own photo.
  if (!story.photo.startsWith("/")) return metadata;
  const image = {
    url: story.photo,
    width: 640,
    height: 480,
    alt: story.caption || story.title,
    type: "image/webp",
  };
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, type: "article", images: [image] },
    twitter: { ...metadata.twitter, images: [story.photo] },
  };
}

export default async function NewsPage({ params }: Props) {
  const { id } = await params;
  const story = await getPublicStory(id);
  if (!story) notFound();
  const related = await moreNews(story);
  return (
    <article className="container section narrow news-article">
      <Link className="text-link" href="/#news-title">
        Back to News &amp; Features
      </Link>
      <div className="story-meta">
        <span>
          {id.startsWith("sample-")
            ? "Sample " + story.kind.toLowerCase()
            : story.kind}
        </span>
        <time dateTime={story.date}>
          {new Intl.DateTimeFormat("en-GB", {
            dateStyle: "long",
            timeZone: "UTC",
          }).format(new Date(story.date))}
        </time>
      </div>
      <h1>{story.title}</h1>
      {story.photo && (
        <figure>
          <Image
            src={story.photo}
            alt={story.caption}
            width={640}
            height={480}
            unoptimized
          />
          <figcaption>{story.caption}</figcaption>
        </figure>
      )}
      <p>{story.summary}</p>
      {story.detail && <div className="preserve-lines">{story.detail}</div>}
      {story.project && (
        <Link className="text-link" href={"/projects/" + story.project}>
          View project
        </Link>
      )}
      {id.startsWith("sample-") ? (
        <p className="subtle-note">This sample story is read-only.</p>
      ) : (
        <PublicComments key={id} slug={id} kind="news" />
      )}
      {related.length > 0 && (
        <section
          className="detail-section more-news"
          aria-labelledby="more-news-title"
        >
          <h2 id="more-news-title">More news</h2>
          <ul>
            {related.map((item) => (
              <li key={item.id}>
                <Link className="text-link" href={"/news/" + item.id}>
                  {item.title}
                  <time dateTime={item.date}>
                    {new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "long",
                      timeZone: "UTC",
                    }).format(new Date(item.date))}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
