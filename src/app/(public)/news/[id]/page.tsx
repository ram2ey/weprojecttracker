import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicStory } from "@/lib/news/service";
import { pageMetadata } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const story = await getPublicStory(id);
  if (!story) notFound();
  return pageMetadata(story.title, story.summary, "/news/" + id);
}

export default async function NewsPage({ params }: Props) {
  const { id } = await params;
  const story = await getPublicStory(id);
  if (!story) notFound();
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
    </article>
  );
}
