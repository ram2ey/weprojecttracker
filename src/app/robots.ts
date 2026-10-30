import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  return {
    rules:
      process.env.APP_ENV === "production"
        ? {
            userAgent: "*",
            allow: ["/", "/api/og"],
            disallow: ["/admin", "/staff", "/preview", "/api/"],
          }
        : { userAgent: "*", disallow: "/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
