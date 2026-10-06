"use client";

import { ProductRail, SectionHeader } from "@/components/shop/sections";
import { useHydrated, useRecent } from "@/lib/stores/shop";
import { useProductsByIds } from "@/lib/use-products";

export function RecentlyViewed({ excludeId }: { excludeId?: number }) {
  const hydrated = useHydrated();
  const ids = useRecent((s) => s.ids).filter((id) => id !== excludeId).slice(0, 8);
  const { items } = useProductsByIds(ids, hydrated);
  if (!hydrated || !items.length) return null;
  return (
    <section className="container-page">
      <SectionHeader title="Вы недавно смотрели" />
      <ProductRail products={items} />
    </section>
  );
}
