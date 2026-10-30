import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Wassa East Projects",
    short_name: "Wassa East",
    description: "Approved constituency project information and progress.",
    start_url: "/following",
    scope: "/",
    display: "standalone",
    background_color: "#faf8f2",
    theme_color: "#214e3b",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
