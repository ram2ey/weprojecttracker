import { notFound } from "next/navigation";
import { getPublicContent } from "@/lib/content/public";
import { PublishedContentView } from "@/components/content/published-content";
import { contentMetadata } from "@/lib/site";
import { PublicComments } from "@/components/comments/public-comments";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const r = await getPublicContent((await params).slug);
  return r
    ? contentMetadata(r)
    : { title: "Project not found", robots: { index: false, follow: false } };
}
export default async function Project({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const r = await getPublicContent((await params).slug);
  if (!r) notFound();
  return (
    <>
      <PublishedContentView record={r} />
      <div className="container comments-container">
        <PublicComments key={r.id} slug={r.slug} />
      </div>
    </>
  );
}
