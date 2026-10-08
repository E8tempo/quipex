"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ProductImage } from "@/components/shop/product-card";
import { apiPost } from "@/lib/api-client";
import { plural, price } from "@/lib/format";
import { useAccount } from "@/lib/stores/account";
import { MAX_QTY, useCart, useHydrated } from "@/lib/stores/shop";
import type { Quote } from "@/lib/types";
import { cn } from "@/lib/utils";

const useQuoteStore = create<{ quote: Quote | null; loading: boolean; key: string }>(() => ({
  quote: null,
  loading: false,
  key: "",
}));

/** Монтируется один раз: пересчитывает корзину на сервере (актуальные цены, оптовые скидки). */
export function CartQuoteSync() {
  const items = useCart((s) => s.items);
  const refresh = useCart((s) => s.refresh);
  const removeMissing = useCart((s) => s.removeMissing);
  const who = useAccount((s) => (s.loaded ? `${s.customer?.id ?? 0}:${s.customer?.is_partner ? 1 : 0}` : "?"));
  const key = useMemo(() => `${who}|` + items.map((i) => `${i.id}:${i.qty}`).join(","), [items, who]);

  useEffect(() => {
    const [, cartKey] = key.split("|");
    if (who === "?") return; // ждём, пока выяснится, кто вошёл
    if (!cartKey) {
      useQuoteStore.setState({ quote: null, loading: false, key });
      return;
    }
    let cancelled = false;
    useQuoteStore.setState({ loading: true });
    const t = setTimeout(() => {
      const lines = cartKey.split(",").map((pair) => {
        const [id, qty] = pair.split(":").map(Number);
        return { product_id: id, quantity: qty };
      });
      apiPost<Quote>("/cart/quote", { items: lines })
        .then((q) => {
          if (cancelled) return;
          useQuoteStore.setState({ quote: q, key });
          refresh(q.items.map((l) => l.product));
          // сняты с продажи — иначе висят в корзине со старой ценой, а в заказ молча не попадают
          if (q.missing.length) {
            const names = removeMissing(q.missing);
            toast.warning(
              names.length === 1 ? `Товар «${names[0]}» больше не продаётся и удалён из корзины` : `${names.length} ${plural(names.length, ["товар", "товара", "товаров"])} больше не продаются и удалены из корзины`,
            );
          }
        })
        .catch(() => {})
        .finally(() => !cancelled && useQuoteStore.setState({ loading: false }));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [key, who, refresh, removeMissing]);
  return null;
}

export function useQuote() {
  const quote = useQuoteStore((s) => s.quote);
  const loading = useQuoteStore((s) => s.loading);
  const hasItems = useCart((s) => s.items.length > 0);
  return { quote: hasItems ? quote : null, loading };
}

export function QtyStepper({
  value,
  onChange,
  size = "sm",
}: {
  value: number;
  onChange: (v: number) => void;
  size?: "sm" | "lg";
}) {
  const [draft, setDraft] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setDraft(String(value));
  }
  const h = size === "lg" ? "h-11" : "h-8";
  return (
    <div className={cn("inline-flex items-center rounded-full border bg-background px-1", h)}>
      <button
        type="button"
        className={cn("flex aspect-square items-center justify-center text-muted-foreground hover:text-foreground", h)}
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label="Уменьшить"
      >
        <Minus className="size-3.5" />
      </button>
      <input
        inputMode="numeric"
        className="w-10 bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
        onBlur={() => {
          const n = Math.min(MAX_QTY, Math.max(1, Number(draft) || 1));
          setDraft(String(n));
          onChange(n);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        aria-label="Количество"
      />
      <button
        type="button"
        className={cn("flex aspect-square items-center justify-center text-muted-foreground hover:text-foreground", h)}
        onClick={() => onChange(Math.min(MAX_QTY, value + 1))}
        aria-label="Увеличить"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export function CartLines({ compact }: { compact?: boolean }) {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const setOpen = useCart((s) => s.setOpen);
  const { quote } = useQuote();
  const lineById = new Map(quote?.items.map((l) => [l.product.id, l]));

  return (
    <ul className="divide-y">
      {items.map((item) => {
        const line = lineById.get(item.id);
        const unit = line ? line.price : item.product.price;
        return (
          <li key={item.id} className={cn("flex gap-4", compact ? "py-4" : "py-5")}>
            <Link
              href={`/product/${item.product.slug}`}
              onClick={() => setOpen(false)}
              className={cn("shrink-0 overflow-hidden rounded-xl img-tile p-1.5", compact ? "size-20" : "size-24")}
            >
              <ProductImage src={item.product.image} alt={item.product.name} />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/product/${item.product.slug}`}
                  onClick={() => setOpen(false)}
                  className="line-clamp-2 text-sm leading-snug font-medium hover:text-brand"
                >
                  {item.product.name}
                </Link>
                <button
                  className="-mt-1 -mr-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                  onClick={() => remove(item.id)}
                  aria-label="Удалить"
                >
                  {compact ? <X className="size-4" /> : <Trash2 className="size-4" />}
                </button>
              </div>
              <div className="mt-auto flex flex-wrap items-end justify-between gap-2">
                <QtyStepper value={item.qty} onChange={(v) => setQty(item.id, v)} />
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{price(Number(unit) * item.qty)}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.qty > 1 ? `${price(unit)} / шт` : null}
                    {line?.price_kind === "partner" ? (
                      <span className="ml-1 font-medium text-success">партнёр</span>
                    ) : line?.is_wholesale_price ? (
                      <span className="ml-1 font-medium text-success">опт</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CartSummary({ wholesaleMinQty, wholesaleMinSum }: { wholesaleMinQty?: number; wholesaleMinSum?: number }) {
  const items = useCart((s) => s.items);
  const { quote, loading } = useQuote();
  const localTotal = items.reduce((s, i) => s + Number(i.product.price) * i.qty, 0);
  const total = quote ? Number(quote.total) : localTotal;
  const savings = quote ? Number(quote.savings) : 0;
  const count = items.reduce((s, i) => s + i.qty, 0);
  const toWholesale = wholesaleMinSum ? wholesaleMinSum - (quote ? Number(quote.retail_total) : localTotal) : 0;

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>
          {count} {plural(count, ["товар", "товара", "товаров"])}
        </span>
        <span className="tabular-nums">{price(quote ? quote.retail_total : localTotal)}</span>
      </div>
      {savings > 0 ? (
        <div className="flex justify-between text-sm font-medium text-success">
          <span>{quote?.is_partner ? "Партнёрская скидка" : "Оптовая скидка"}</span>
          <span className="tabular-nums">−{price(savings)}</span>
        </div>
      ) : null}
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">Итого</span>
        <span className={cn("text-2xl font-semibold tabular-nums transition-opacity", loading && "opacity-60")}>
          {price(total)}
        </span>
      </div>
      {!quote?.is_partner && wholesaleMinSum && toWholesale > 0 && toWholesale < wholesaleMinSum ? (
        <div className="rounded-2xl bg-muted p-3.5 text-xs text-muted-foreground">
          Добавьте товаров ещё на <b>{price(toWholesale)}</b> — и вся корзина пересчитается по оптовым ценам
          {wholesaleMinQty ? `, либо возьмите от ${wholesaleMinQty} шт. одной позиции` : ""}.
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-foreground transition-all"
              style={{ width: `${Math.min(100, ((wholesaleMinSum - toWholesale) / wholesaleMinSum) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CartSheet({ wholesaleMinQty, wholesaleMinSum }: { wholesaleMinQty?: number; wholesaleMinSum?: number }) {
  const open = useCart((s) => s.open);
  const setOpen = useCart((s) => s.setOpen);
  const items = useCart((s) => s.items);
  const hydrated = useHydrated();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="text-lg">Корзина</SheetTitle>
        </SheetHeader>
        {!hydrated || items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="size-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">Корзина пуста</p>
              <p className="mt-1 text-sm text-muted-foreground">Загляните в каталог — там много интересного</p>
            </div>
            <Link href="/catalog" className={buttonVariants()} onClick={() => setOpen(false)}>
              Перейти в каталог
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5">
              <CartLines compact />
            </div>
            <div className="space-y-4 border-t p-5">
              <CartSummary wholesaleMinQty={wholesaleMinQty} wholesaleMinSum={wholesaleMinSum} />
              <div className="grid grid-cols-2 gap-2">
                <Link href="/cart" onClick={() => setOpen(false)} className={buttonVariants({ variant: "outline", size: "lg" })}>
                  Корзина
                </Link>
                <Link href="/checkout" onClick={() => setOpen(false)} className={buttonVariants({ size: "lg" })}>
                  Оформить
                </Link>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function ClearCartButton() {
  const clear = useCart((s) => s.clear);
  return (
    <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
      <Trash2 /> Очистить
    </Button>
  );
}
