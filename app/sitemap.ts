import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Every public page. Add routes here as the app grows; private tools return none. */
const PATHS = [""];

export default function sitemap(): MetadataRoute.Sitemap {
  if (!site.isPublic) return [];
  return PATHS.map((path) => ({ url: `${site.url}${path}`, lastModified: new Date() }));
}
