import { cache } from "react";
import { connection } from "next/server";
import { apiGet } from "@/lib/api-server";
import type { CategoryNode, SiteSettings } from "@/lib/types";

export const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");

const FALLBACK: SiteSettings = {
  site_name: "Квипекс",
  tagline: "",
  phone: "",
  phone_secondary: "",
  email: "",
  address: "",
  work_hours: "",
  inn: "",
  legal_name: "",
  telegram: "",
  whatsapp: "",
  vk: "",
  map_embed_url: "",
  hero_title: "Системы отопления",
  hero_subtitle: "",
  announcement: "",
  free_delivery_from: 0,
  wholesale_min_qty: 0,
  wholesale_min_order_sum: 0,
  wholesale_default_discount_percent: 0,
  delivery_methods: [],
  payment_methods: [],
  seo_title: "",
  seo_description: "",
  pages: [],
};

export const getSettings = cache(async (): Promise<SiteSettings> => {
  await connection();
  try {
    return { ...FALLBACK, ...(await apiGet<SiteSettings>("/settings")) };
  } catch {
    return FALLBACK;
  }
});

export const getCategoryTree = cache(async (): Promise<CategoryNode[]> => {
  await connection();
  try {
    return await apiGet<CategoryNode[]>("/categories");
  } catch {
    return [];
  }
});
