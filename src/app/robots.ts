import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = APP_URL();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Rien d'utile à indexer côté privé, et surtout rien à gaspiller en
        // budget de crawl.
        disallow: ["/api/", "/dashboard", "/login", "/en/dashboard", "/en/login", "/admin"],
      },
    ],
    sitemap: [`${base}/sitemap/0.xml`],
    host: base,
  };
}
