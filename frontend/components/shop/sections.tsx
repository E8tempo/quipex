import Link from "next/link";
import { ArrowRight, ArrowUpRight, Headphones, ShieldCheck, Truck, Warehouse } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ProductCard } from "@/components/shop/product-card";
import { price } from "@/lib/format";
import type { CategoryNode, ProductCard as Product, SiteSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SectionHeader({ title, href, linkLabel = "Смотреть все", subtitle }: { title: string; href?: string; linkLabel?: string; subtitle?: string }) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold sm:text-[28px]">{title}</h2>
        {subtitle ? <p className="mt-1 text-muted-foreground">{subtitle}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="group flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground">
          {linkLabel}
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}

export function ProductRail({ products }: { products: Product[] }) {
  return (
    <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 sm:overflow-visible sm:px-0 xl:grid-cols-4">
      {products.map((p) => (
        <div key={p.id} className="w-[46vw] max-w-64 shrink-0 snap-start sm:w-auto sm:max-w-none">
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}

export function CategoryTiles({ categories, limit }: { categories: CategoryNode[]; limit?: number }) {
  const list = limit ? categories.slice(0, limit) : categories;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {list.map((c) => (
        <Link key={c.id} href={`/catalog/${c.slug}`} className="group img-tile relative flex aspect-[5/4] flex-col overflow-hidden rounded-2xl p-4 sm:p-5">
          <span className="relative z-10 max-w-[85%] text-[15px] leading-snug font-medium text-zinc-900 sm:text-base">{c.name}</span>
          <span className="relative z-10 mt-1 text-xs text-zinc-500">{c.product_count} товаров</span>
          {c.cover ? (
            <img
              src={c.cover}
              alt=""
              loading="lazy"
              className="absolute right-0 bottom-0 h-[62%] w-[62%] object-contain object-right-bottom p-3 transition duration-500 group-hover:scale-105"
            />
          ) : null}
          <ArrowUpRight className="absolute top-4 right-4 size-4 text-zinc-400 opacity-0 transition group-hover:opacity-100" />
        </Link>
      ))}
    </div>
  );
}

export function Benefits({ settings, className }: { settings: SiteSettings; className?: string }) {
  const items = [
    { icon: Truck, text: "Доставка по всей России" },
    { icon: ShieldCheck, text: "Официальная гарантия" },
    {
      icon: Warehouse,
      text: settings.wholesale_min_order_sum ? `Опт от ${price(settings.wholesale_min_order_sum)}` : "Опт и розница",
    },
    { icon: Headphones, text: "Помощь в подборе" },
  ];
  return (
    <ul className={cn("grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-muted-foreground lg:flex lg:justify-between", className)}>
      {items.map((it) => (
        <li key={it.text} className="flex items-center gap-2.5">
          <it.icon className="size-[18px] shrink-0 text-foreground/60" strokeWidth={1.75} />
          {it.text}
        </li>
      ))}
    </ul>
  );
}

export function WholesaleBand({ settings }: { settings: SiteSettings }) {
  const disc = settings.wholesale_default_discount_percent;
  return (
    <section className="flex flex-col gap-6 rounded-3xl bg-muted px-6 py-10 sm:px-10 md:flex-row md:items-center md:justify-between md:py-12">
      <div className="max-w-xl space-y-2">
        <p className="text-sm text-muted-foreground">Для монтажников, застройщиков и магазинов</p>
        <h2 className="text-2xl font-semibold sm:text-3xl">
          Оптовые цены{disc ? ` — скидка до ${disc}%` : ""}
        </h2>
        <p className="text-muted-foreground">Работаем по договору с НДС, отгружаем со склада, закрепляем персонального менеджера.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link href="/wholesale" className={buttonVariants({ size: "lg", className: "h-11 rounded-full px-6" })}>
          Условия для опта
        </Link>
      </div>
    </section>
  );
}
