import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { RecentlyViewed } from "@/components/shop/recently-viewed";
import { Benefits, CategoryTiles, ProductRail, SectionHeader, WholesaleBand } from "@/components/shop/sections";
import { apiGet } from "@/lib/api-server";
import { price } from "@/lib/format";
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
  const [settings, categories, featured, sale] = await Promise.all([
    getSettings(),
    getCategoryTree(),
    safeList({ featured: true, per_page: 8 }),
    safeList({ sale: true, per_page: 4 }),
  ]);
  const popular = featured?.items.length ? featured : await safeList({ sort: "popular", per_page: 8 });
  const hero = (popular?.items ?? []).find((p) => p.image && p.in_stock) ?? popular?.items[0];

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
          {hero?.image ? (
            <Link href={`/product/${hero.slug}`} className="group img-tile relative block aspect-[4/3] overflow-hidden rounded-[2rem] md:aspect-[16/9] lg:aspect-[4/3.4]">
              <img src={hero.image} alt={hero.name} className="absolute inset-0 size-full object-contain p-[14%] transition duration-700 group-hover:scale-[1.03]" />
              <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-4 rounded-2xl bg-white/85 px-4 py-3 text-zinc-900 backdrop-blur sm:inset-x-5 sm:bottom-5">
                <span className="line-clamp-1 text-sm">{hero.name}</span>
                <span className="shrink-0 text-sm font-semibold">{price(hero.price)}</span>
              </div>
            </Link>
          ) : null}
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
