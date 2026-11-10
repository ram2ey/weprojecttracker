import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Wassa East Projects",
    short_name: "Wassa East",
    description:
      "Follow public projects and news across Wassa East Constituency. Internet connection required.",
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6f7",
    theme_color: "#006b3f",
    prefer_related_applications: false,
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
