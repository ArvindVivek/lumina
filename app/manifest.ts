import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Home-screen install. Render public/icon-192.png and public/icon-512.png from the full-bleed
// icon source: rsvg-convert -w 512 -h 512 icon-source.svg -o public/icon-512.png
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: site.themeColor.light,
    theme_color: site.themeColor.light,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
