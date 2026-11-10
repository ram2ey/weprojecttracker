import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";
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
  fallback: ["Segoe UI", "Arial", "sans-serif"],
});
export function generateMetadata(): Metadata {
  return {
    applicationName: "Wassa East Projects",
    appleWebApp: {
      capable: true,
      title: "Wassa East",
      statusBarStyle: "default",
    },
    icons: {
      apple: [
        {
          url: "/brand/apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    metadataBase: new URL(
      process.env.BETTER_AUTH_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3000",
    ),

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
export const viewport: Viewport = {
  themeColor: "#006b3f",
  width: "device-width",
  initialScale: 1,
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // A new CSP nonce is required on every HTML response, including sign-in/errors.
  await connection();
  return (
    <html lang="en" className={creato.variable}>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
