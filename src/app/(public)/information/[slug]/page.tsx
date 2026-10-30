import { notFound } from "next/navigation";
import { getPublicContent } from "@/lib/content/public";
import { PublishedContentView } from "@/components/content/published-content";
import type { Metadata } from "next";
import { contentMetadata } from "@/lib/site";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const record = await getPublicContent((await params).slug);
  return record && record.kind !== "project"
    ? contentMetadata(record)
    : { title: "Publication", robots: { index: false, follow: false } };
}
export default async function InformationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const record = await getPublicContent(slug);
  if (!record || record.kind === "project") notFound();
  return <PublishedContentView record={record} />;
}
