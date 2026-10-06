import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/site";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  return {
    id: "/",
    name: s.site_name,
    short_name: s.site_name,
    description: s.tagline || s.hero_subtitle || "Системы отопления — опт и розница",
    lang: "ru",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fdfdfd",
    theme_color: "#fdfdfd",
    categories: ["shopping", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Каталог", url: "/catalog", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Корзина", url: "/cart", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Скидки", url: "/sale", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
