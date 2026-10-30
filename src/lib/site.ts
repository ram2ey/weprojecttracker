import type { Metadata } from "next";
import type { PublicContent } from "./content/types";
export function siteUrl() {
  const configured =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const url = new URL(configured);
  return url.origin;
}
export function pageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "Wassa East Projects",
      title,
      description,
      url: path,
      images: [
        {
          url: "/api/og",
          width: 1200,
          height: 630,
          alt: "Wassa East Projects — Our communities. Our progress.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/api/og"],
    },
  };
}
export function contentMetadata(record: PublicContent): Metadata {
  const path = `/${record.kind === "project" ? "projects" : "information"}/${record.slug}`,
    description = record.payload.description.slice(0, 180),
    image = `/api/og?slug=${encodeURIComponent(record.slug)}`;
  return {
    ...pageMetadata(record.payload.title, description, path),
    openGraph: {
      type: "article",
      siteName: "Wassa East Projects",
      url: path,
      title: record.payload.title,
      description,
      modifiedTime: record.publishedAt,
      images: [
        { url: image, width: 1200, height: 630, alt: record.payload.title },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: record.payload.title,
      description,
      images: [image],
    },
  };
}
