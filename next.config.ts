import type { NextConfig } from "next";

const PRIVATE_PAGES = ["/admin", "/finances", "/stats"];

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [65, 70, 75],
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },
  experimental: {
    optimizePackageImports: ["framer-motion", "lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/:all*(webp|avif|jpg|jpeg|png|svg|ico)",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }],
      },
      {
        // Basic browser protections on every page.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The site may not be shown inside another site's frame (clickjacking).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // The admin pages must never show up in Google.
      ...PRIVATE_PAGES.flatMap((page) =>
        [page, `${page}/:path*`].map((source) => ({
          source,
          headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
        })),
      ),
    ];
  },
};

export default nextConfig;
