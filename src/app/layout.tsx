import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/newsreader";
import "./globals.css";
export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(
      process.env.BETTER_AUTH_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3000",
    ),
    manifest: "/manifest.webmanifest",
    icons: { apple: "/icons/icon-180.png" },
    robots:
      process.env.APP_ENV !== "production"
        ? { index: false, follow: false }
        : undefined,
    title: {
      default: "Wassa East Projects | Our communities. Our progress.",
      template: "%s | Wassa East Projects",
    },
    description:
      "Explore approved project information, progress and evidence from Wassa East Constituency.",
  };
}
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
