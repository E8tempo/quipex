"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { ProductCard } from "@/lib/types";

/** Загружает карточки по списку id (избранное, недавно просмотренные). */
export function useProductsByIds(ids: number[], enabled = true) {
  const key = ids.join(",");
  const [state, setState] = useState<{ key: string; items: ProductCard[] } | null>(null);

  useEffect(() => {
    if (!enabled || !key) return;
    let cancelled = false;
    api<ProductCard[]>(`/products/by-ids?ids=${key}`)
      .then((items) => !cancelled && setState({ key, items }))
      .catch(() => !cancelled && setState({ key, items: [] }));
    return () => {
      cancelled = true;
    };
  }, [key, enabled]);

  if (!key) return { items: [] as ProductCard[], loading: false };
  const fresh = state?.key === key;
  return { items: state?.items ?? [], loading: !fresh };
}
