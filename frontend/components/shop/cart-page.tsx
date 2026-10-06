"use client";

import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CartLines, CartSummary, ClearCartButton } from "@/components/shop/cart";
import { useCart, useHydrated } from "@/lib/stores/shop";

export function CartPageView({ wholesaleMinQty, wholesaleMinSum }: { wholesaleMinQty: number; wholesaleMinSum: number }) {
  const hydrated = useHydrated();
  const count = useCart((s) => s.items.length);

  if (!hydrated) return <div className="h-64 animate-pulse rounded-3xl bg-muted" />;
  if (!count) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-muted/60 py-20 text-center">
        <ShoppingBag className="size-14 text-muted-foreground/40" />
        <h1 className="text-2xl font-semibold">Корзина пуста</h1>
        <p className="text-muted-foreground">Добавьте товары из каталога, чтобы оформить заказ</p>
        <Link href="/catalog" className={buttonVariants({ size: "lg" })}>
          Перейти в каталог
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Корзина</h1>
        <ClearCartButton />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="rounded-2xl border px-5 sm:px-6">
          <CartLines />
        </div>
        <div className="space-y-4 rounded-2xl border p-6 lg:sticky lg:top-28">
          <CartSummary wholesaleMinQty={wholesaleMinQty} wholesaleMinSum={wholesaleMinSum} />
          <Link href="/checkout" className={buttonVariants({ size: "lg", className: "h-12 w-full text-base" })}>
            Перейти к оформлению <ArrowRight />
          </Link>
        </div>
      </div>
    </div>
  );
}
