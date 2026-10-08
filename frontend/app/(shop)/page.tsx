import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { RecentlyViewed } from "@/components/shop/recently-viewed";
import { HeroGallery } from "@/components/shop/hero-gallery";
import { Benefits, CategoryTiles, ProductRail, SectionHeader, WholesaleBand } from "@/components/shop/sections";
import { apiGet } from "@/lib/api-server";
import { getCategoryTree, getSettings } from "@/lib/site";
import type { ProductList } from "@/lib/types";

async function safeList(params: Record<string, string | number | boolean>) {
  try {
    return await apiGet<ProductList>("/products", { ...params, facets: false });
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const [settings, categories, featured, sale, gallery] = await Promise.all([
    getSettings(),
    getCategoryTree(),
    safeList({ featured: true, per_page: 8 }),
    safeList({ sale: true, per_page: 4 }),
    safeList({ sort: "popular", per_page: 12 }),
  ]);
  const popular = featured?.items.length ? featured : await safeList({ sort: "popular", per_page: 8 });

  return (
    <div className="space-y-20 sm:space-y-28">
      <section className="container-page pt-6 sm:pt-10">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="space-y-7">
            <h1 className="text-[40px] leading-[1.05] font-semibold text-balance sm:text-6xl">{settings.hero_title}</h1>
            {settings.hero_subtitle ? (
              <p className="max-w-lg text-lg text-pretty text-muted-foreground">{settings.hero_subtitle}</p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Link href="/catalog" className={buttonVariants({ size: "lg", className: "h-12 rounded-full px-7 text-[15px]" })}>
                Перейти в каталог
              </Link>
              <Link href="/wholesale" className={buttonVariants({ size: "lg", variant: "ghost", className: "h-12 rounded-full px-5 text-[15px]" })}>
                Оптовым клиентам <ArrowRight />
              </Link>
            </div>
          </div>
          {gallery?.items.length ? <HeroGallery products={gallery.items} /> : null}
        </div>
        <Benefits settings={settings} className="mt-14 border-t pt-6" />
      </section>

      {categories.length ? (
        <section className="container-page">
          <SectionHeader title="Категории" href="/catalog" linkLabel="Весь каталог" />
          <CategoryTiles categories={categories} limit={8} />
        </section>
      ) : (
        <section className="container-page">
          <div className="rounded-3xl bg-muted p-10 text-center text-muted-foreground">
            Каталог пока пуст. Запустите импорт в{" "}
            <Link href="/admin/import" className="text-foreground underline">
              админ-панели
            </Link>
            .
          </div>
        </section>
      )}

      {popular?.items.length ? (
        <section className="container-page">
          <SectionHeader title={featured?.items.length ? "Хиты продаж" : "Популярное"} href="/catalog" />
          <ProductRail products={popular.items.slice(0, 8)} />
        </section>
      ) : null}

      {sale?.items.length ? (
        <section className="container-page">
          <SectionHeader title="Скидки" href="/sale" />
          <ProductRail products={sale.items.slice(0, 4)} />
        </section>
      ) : null}

      <section className="container-page">
        <WholesaleBand settings={settings} />
      </section>

      <RecentlyViewed />
    </div>
  );
}
