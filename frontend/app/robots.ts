import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { SITE_URL } from "@/lib/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/cart", "/checkout", "/order", "/search", "/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
