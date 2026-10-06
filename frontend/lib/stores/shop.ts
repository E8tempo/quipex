"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductCard } from "@/lib/types";

export interface CartItem {
  id: number;
  qty: number;
  product: ProductCard;
}

interface CartState {
  items: CartItem[];
  open: boolean;
  add: (product: ProductCard, qty?: number) => void;
  setQty: (id: number, qty: number) => void;
  remove: (id: number) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
  refresh: (products: ProductCard[]) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      open: false,
      add: (product, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.id === product.id);
          if (existing) {
            return {
              items: s.items.map((i) => (i.id === product.id ? { ...i, qty: i.qty + qty, product } : i)),
            };
          }
          return { items: [...s.items, { id: product.id, qty, product }] };
        }),
      setQty: (id, qty) =>
        set((s) => ({
          items: qty <= 0 ? s.items.filter((i) => i.id !== id) : s.items.map((i) => (i.id === id ? { ...i, qty } : i)),
        })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
      setOpen: (open) => set({ open }),
      refresh: (products) =>
        set((s) => {
          const map = new Map(products.map((p) => [p.id, p]));
          return { items: s.items.map((i) => (map.has(i.id) ? { ...i, product: map.get(i.id)! } : i)) };
        }),
    }),
    { name: "quipex-cart", partialize: (s) => ({ items: s.items }) },
  ),
);

interface IdListState {
  ids: number[];
  toggle: (id: number) => boolean;
  has: (id: number) => boolean;
  remove: (id: number) => void;
  clear: () => void;
}

function idListStore(name: string, limit: number) {
  return create<IdListState>()(
    persist(
      (set, get) => ({
        ids: [],
        toggle: (id) => {
          const present = get().ids.includes(id);
          set((s) => ({ ids: present ? s.ids.filter((x) => x !== id) : [id, ...s.ids].slice(0, limit) }));
          return !present;
        },
        has: (id) => get().ids.includes(id),
        remove: (id) => set((s) => ({ ids: s.ids.filter((x) => x !== id) })),
        clear: () => set({ ids: [] }),
      }),
      { name },
    ),
  );
}

export const useFavorites = idListStore("quipex-favorites", 200);
export const useCompare = idListStore("quipex-compare", 6);

interface RecentState {
  ids: number[];
  push: (id: number) => void;
}

export const useRecent = create<RecentState>()(
  persist(
    (set) => ({
      ids: [],
      push: (id) => set((s) => ({ ids: [id, ...s.ids.filter((x) => x !== id)].slice(0, 12) })),
    }),
    { name: "quipex-recent" },
  ),
);

/** true после гидратации — чтобы не было расхождений SSR и localStorage. */
const noopSubscribe = () => () => {};
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
