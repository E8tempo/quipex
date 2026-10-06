import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { Listing } from "@/components/shop/listing";
import { CategoryTiles } from "@/components/shop/sections";
import { getCategoryTree } from "@/lib/site";

export const metadata: Metadata = { title: "Каталог", alternates: { canonical: "/catalog" } };

export default async function CatalogPage({ searchParams }: PageProps<"/catalog">) {
  const [sp, categories] = await Promise.all([searchParams, getCategoryTree()]);
  return (
    <div className="container-page space-y-8 pt-6">
      <Breadcrumbs items={[{ label: "Каталог" }]} />
      <h1 className="text-3xl font-semibold">Каталог</h1>
      <CategoryTiles categories={categories} />
      <div className="pt-4">
        <h2 className="mb-5 text-2xl font-semibold">Все товары</h2>
        <Listing sp={sp} basePath="/catalog" />
      </div>
    </div>
  );
}
