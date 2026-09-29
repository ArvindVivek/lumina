import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Public sites: crawl everything but the API. Private single-owner tools (site.isPublic =
// false): disallow everything and publish no sitemap.
export default function robots(): MetadataRoute.Robots {
  if (!site.isPublic) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
