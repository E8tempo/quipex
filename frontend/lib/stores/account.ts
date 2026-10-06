"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { api, apiPost } from "@/lib/api-client";
import type { Customer, Money } from "@/lib/types";

interface AccountState {
  customer: Customer | null;
  loaded: boolean;
  set: (c: Customer | null) => void;
  load: () => Promise<Customer | null>;
  logout: () => Promise<void>;
}

export const useAccount = create<AccountState>()((set) => ({
  customer: null,
  loaded: false,
  set: (customer) => {
    set({ customer, loaded: true });
    usePersonalPrices.getState().reset();
  },
  load: async () => {
    if (!document.cookie.split("; ").some((c) => c === "cvipex_at_in=1")) {
      set({ customer: null, loaded: true });
      return null;
    }
    try {
      const c = await api<Customer>("/account/me");
      set({ customer: c, loaded: true });
      return c;
    } catch {
      set({ customer: null, loaded: true });
      return null;
    }
  },
  logout: async () => {
    await apiPost("/account/auth/logout").catch(() => {});
    set({ customer: null, loaded: true });
    usePersonalPrices.getState().reset();
  },
}));

// ---------- персональные цены партнёра ----------
// Витрина рендерится и кешируется на сервере одинаковой для всех, поэтому цены партнёра
// подгружаются в браузере пачками по видимым товарам.

interface PersonalPrice {
  price: Money;
  kind: string;
}

interface PricesState {
  prices: Record<number, PersonalPrice | null>;
  queue: Set<number>;
  request: (id: number) => void;
  reset: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const usePersonalPrices = create<PricesState>()((set, get) => ({
  prices: {},
  queue: new Set(),
  request: (id) => {
    if (id in get().prices || get().queue.has(id)) return;
    get().queue.add(id);
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null;
      const ids = [...get().queue];
      get().queue.clear();
      if (!ids.length) return;
      let data: Record<string, PersonalPrice> = {};
      try {
        data = await api<Record<string, PersonalPrice>>(`/account/prices?ids=${ids.join(",")}`);
      } catch {}
      set((s) => {
        const next = { ...s.prices };
        for (const pid of ids) next[pid] = data[pid] ?? null;
        return { prices: next };
      });
    }, 40);
  },
  reset: () => set({ prices: {}, queue: new Set() }),
}));

/** Цена партнёра для товара (null — нет, обычная цена). */
export function usePersonalPrice(productId: number): PersonalPrice | null {
  const isPartner = useAccount((s) => !!s.customer?.is_partner);
  const price = usePersonalPrices((s) => s.prices[productId]);
  const request = usePersonalPrices((s) => s.request);
  useEffect(() => {
    if (isPartner) request(productId);
  }, [isPartner, productId, request]);
  return isPartner && price ? price : null;
}

/** Монтируется один раз в layout магазина: узнаёт, кто вошёл (и тем самым обновляет сессию). */
export function AccountSync() {
  const load = useAccount((s) => s.load);
  useEffect(() => {
    load();
  }, [load]);
  return null;
}
