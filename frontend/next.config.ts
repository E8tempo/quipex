import type { NextConfig } from "next";

// Адрес бэкенда внутри сети (docker-compose: http://backend:8000).
// Используется только для серверных запросов и как запасной прокси /api и /media,
// если перед Next.js не стоит обратный прокси (Caddy).
const apiInternal = (process.env.API_INTERNAL_URL || "http://localhost:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiInternal}/api/:path*` },
      { source: "/media/:path*", destination: `${apiInternal}/media/:path*` },
    ];
  },
};

export default nextConfig;
