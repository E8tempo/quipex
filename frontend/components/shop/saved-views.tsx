"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, Heart, Trash2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AddToCartButton, ProductGrid, ProductImage } from "@/components/shop/product-card";
import { api } from "@/lib/api-client";
import { price } from "@/lib/format";
import { useCompare, useFavorites, useHydrated } from "@/lib/stores/shop";
import type { ProductCard } from "@/lib/types";
import { useProductsByIds } from "@/lib/use-products";
import { cn } from "@/lib/utils";

function Empty({ icon: Icon, title, text }: { icon: typeof Heart; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-muted/60 py-20 text-center">
      <Icon className="size-12 text-muted-foreground/40" />
      <p className="text-xl font-semibold">{title}</p>
      <p className="text-muted-foreground">{text}</p>
      <Link href="/catalog" className={buttonVariants({ className: "mt-2" })}>
        В каталог
      </Link>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="aspect-[3/5] animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}

export function FavoritesView() {
  const hydrated = useHydrated();
  const ids = useFavorites((s) => s.ids);
  const clear = useFavorites((s) => s.clear);
  const { items, loading } = useProductsByIds(ids, hydrated);
  if (!hydrated || (loading && !items.length && ids.length)) return <GridSkeleton />;
  if (!ids.length) return <Empty icon={Heart} title="В избранном пусто" text="Нажимайте ♡ на карточках товаров, чтобы сохранить их здесь" />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
          <Trash2 /> Очистить
        </Button>
      </div>
      <ProductGrid products={items} />
    </div>
  );
}

interface CompareData {
  products: ProductCard[];
  attributes: { name: string; values: (string | null)[] }[];
}

export function CompareView() {
  const hydrated = useHydrated();
  const ids = useCompare((s) => s.ids);
  const remove = useCompare((s) => s.remove);
  const clear = useCompare((s) => s.clear);
  const [data, setData] = useState<CompareData | null>(null);
  const [diffOnly, setDiffOnly] = useState(false);
  const key = ids.join(",");

  useEffect(() => {
    if (!hydrated || !key) return;
    api<CompareData>(`/products/compare?ids=${key}`).then(setData).catch(() => {});
  }, [key, hydrated]);

  if (!hydrated) return <GridSkeleton />;
  if (!ids.length) return <Empty icon={BarChart3} title="Нечего сравнивать" text="Добавьте товары к сравнению кнопкой на карточке товара" />;
  if (!data) return <GridSkeleton />;

  const products = data.products.filter((p) => ids.includes(p.id));
  const idxs = data.products.map((p, i) => (ids.includes(p.id) ? i : -1)).filter((i) => i >= 0);
  const rows = data.attributes
    .map((a) => ({ name: a.name, values: idxs.map((i) => a.values[i]) }))
    .filter((r) => r.values.some(Boolean))
    .filter((r) => !diffOnly || new Set(r.values.map((v) => v ?? "")).size > 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={diffOnly} onCheckedChange={setDiffOnly} /> Только различия
        </label>
        <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
          <Trash2 /> Очистить
        </Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-48 bg-card p-4 text-left align-bottom font-medium text-muted-foreground">
                {products.length} товара
              </th>
              {products.map((p) => (
                <th key={p.id} className="min-w-56 p-4 text-left align-top font-normal">
                  <div className="relative space-y-3">
                    <button onClick={() => remove(p.id)} className="absolute -top-1 -right-1 rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Убрать">
                      <X className="size-4" />
                    </button>
                    <Link href={`/product/${p.slug}`} className="block aspect-square overflow-hidden rounded-xl img-tile p-3">
                      <ProductImage src={p.image} alt={p.name} />
                    </Link>
                    <Link href={`/product/${p.slug}`} className="line-clamp-3 font-semibold hover:text-brand">
                      {p.name}
                    </Link>
                    <p className="text-lg font-semibold">{price(p.price)}</p>
                    <AddToCartButton product={p} full size="sm" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.name} className={cn(ri % 2 === 0 && "bg-muted/40")}>
                <td className={cn("sticky left-0 p-3 px-4 text-muted-foreground", ri % 2 === 0 ? "bg-muted" : "bg-card")}>{r.name}</td>
                {r.values.map((v, i) => (
                  <td key={i} className="p-3 px-4 font-medium">
                    {v ?? <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
