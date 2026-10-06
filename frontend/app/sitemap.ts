import type { MetadataRoute } from "next";
import { apiGet } from "@/lib/api-server";
import { SITE_URL } from "@/lib/site";

interface SitemapData {
  products: { slug: string; updated_at: string | null }[];
  categories: { slug: string; updated_at: string | null }[];
  pages: { slug: string; updated_at: string | null }[];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics = ["", "/catalog", "/sale", "/wholesale", "/contacts"].map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: "daily" as const,
    priority: p ? 0.8 : 1,
  }));
  let data: SitemapData = { products: [], categories: [], pages: [] };
  try {
    data = await apiGet<SitemapData>("/sitemap", undefined, { revalidate: 600 });
  } catch {}
  const map = (prefix: string, items: SitemapData["products"], priority: number) =>
    items.map((i) => ({
      url: `${SITE_URL}${prefix}/${i.slug}`,
      lastModified: i.updated_at ? new Date(i.updated_at) : undefined,
      priority,
    }));
  return [
    ...statics,
    ...map("/catalog", data.categories, 0.8),
    ...map("/product", data.products, 0.7),
    ...map("/info", data.pages, 0.4),
  ];
}
