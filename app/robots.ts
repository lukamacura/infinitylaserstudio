import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/finances", "/stats", "/fnl", "/api/"],
      },
    ],
    sitemap: "https://www.infinitylaserstudio.com/sitemap.xml",
  };
}
