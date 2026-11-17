import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { newsPage } from "@/lib/news/service";
import { sampleStories } from "@/lib/news/samples";
import { isDesignPreview } from "@/lib/env";
import { NewsGrid } from "@/components/homepage-sections";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata(
  "News & Features",
  "News and features about projects and communities across Wassa East Constituency.",
  "/news",
);

type Props = { searchParams: Promise<{ page?: string | string[] }> };

// The Android app opens here; the website keeps News & Features on its homepage
// and does not link this page from its menu.
export default async function NewsIndex({ searchParams }: Props) {
  const parsed = z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .safeParse((await searchParams).page ?? 1);
  if (!parsed.success) notFound();
  const page = parsed.data;
  const { stories, hasMore } = await newsPage(page);
  if (page > 1 && !stories.length) notFound();
  const sample = page === 1 && !stories.length && isDesignPreview();
  return (
    <div className="container section news-index">
      <h1>News &amp; Features</h1>
      <NewsGrid
        stories={sample ? sampleStories : stories}
        sample={sample}
        as="h2"
      />
      {(page > 1 || hasMore) && (
        <nav className="news-pages" aria-label="News pages">
          {page > 1 ? (
            <Link
              className="button button-outline"
              href={page === 2 ? "/news" : `/news?page=${page - 1}`}
            >
              Newer stories
            </Link>
          ) : (
            <span />
          )}
          <span>Page {page}</span>
          {hasMore ? (
            <Link
              className="button button-outline"
              href={`/news?page=${page + 1}`}
            >
              Older stories
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
