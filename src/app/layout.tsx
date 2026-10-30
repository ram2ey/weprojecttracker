import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const creato = localFont({
  src: [
    {
      path: "./fonts/CreatoDisplay-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/CreatoDisplay-Medium.otf",
      weight: "500",
      style: "normal",
    },
    { path: "./fonts/CreatoDisplay-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-creato",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});
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
    <html lang="en" className={creato.variable} data-scroll-behavior="smooth">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
