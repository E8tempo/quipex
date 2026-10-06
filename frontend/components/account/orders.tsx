"use client";

import Link from "next/link";
import { ArrowLeft, Package, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorBox, Loading, Pill, useApi } from "@/components/admin/ui";
import { ProductImage } from "@/components/shop/product-card";
import { api } from "@/lib/api-client";
import { ORDER_STATUS, dateTime, price } from "@/lib/format";
import { useCart } from "@/lib/stores/shop";
import type { Order, ProductCard } from "@/lib/types";

export function OrdersView() {
  const { data, error, loading } = useApi<Order[]>("/account/orders");
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data?.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-muted/60 py-16 text-center">
        <Package className="size-10 text-muted-foreground/50" strokeWidth={1.5} />
        <p className="font-medium">Заказов пока нет</p>
        <Link href="/catalog" className={buttonVariants({ className: "mt-2 h-10 px-5" })}>
          Перейти в каталог
        </Link>
      </div>
    );
  }
  return (
    <ul className="divide-y">
      {data.map((o) => (
        <li key={o.id}>
          <Link href={`/account/orders/${encodeURIComponent(o.number)}`} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4 transition hover:bg-muted/40 sm:px-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium">Заказ № {o.number}</p>
              <p className="text-sm text-muted-foreground">
                {dateTime(o.created_at)} · {o.items.reduce((s, i) => s + i.quantity, 0)} шт.
              </p>
            </div>
            <div className="flex -space-x-2">
              {o.items.slice(0, 4).map((i) => (
                <span key={i.id} className="img-tile size-10 overflow-hidden rounded-full p-1 ring-2 ring-background">
                  <ProductImage src={i.image} alt="" />
                </span>
              ))}
            </div>
            <Pill tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label}</Pill>
            <span className="w-28 text-right font-semibold tabular-nums">{price(o.total)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function OrderDetailView({ number }: { number: string }) {
  const { data: o, error } = useApi<Order>(`/account/orders/${encodeURIComponent(number)}`);
  const add = useCart((s) => s.add);
  const setOpen = useCart((s) => s.setOpen);
  if (error) return <ErrorBox message={error} />;
  if (!o) return <Loading />;

  const repeat = async () => {
    const ids = o.items.map((i) => i.product_id).filter(Boolean).join(",");
    if (!ids) return;
    const products = await api<ProductCard[]>(`/products/by-ids?ids=${ids}`);
    const byId = new Map(products.map((p) => [p.id, p]));
    let added = 0;
    for (const i of o.items) {
      const p = i.product_id ? byId.get(i.product_id) : undefined;
      if (p) {
        add(p, i.quantity);
        added++;
      }
    }
    if (added) {
      toast.success("Товары добавлены в корзину");
      setOpen(true);
    } else toast.error("Этих товаров больше нет в продаже");
  };

  return (
    <div className="space-y-6">
      <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Все заказы
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Заказ № {o.number}</h2>
          <p className="text-sm text-muted-foreground">от {dateTime(o.created_at)}</p>
        </div>
        <div className="flex items-center gap-3">
          <Pill tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label}</Pill>
          <Button variant="outline" className="h-9" onClick={repeat}>
            <RotateCcw /> Повторить заказ
          </Button>
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <ul className="divide-y">
          {o.items.map((i) => (
            <li key={i.id} className="flex items-center gap-4 py-4">
              <span className="img-tile size-16 shrink-0 overflow-hidden rounded-xl p-1.5">
                <ProductImage src={i.image} alt="" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm">{i.name}</p>
                <p className="text-xs text-muted-foreground">
                  {price(i.price)} × {i.quantity}
                  {i.price_kind === "partner" ? " · партнёрская цена" : i.is_wholesale_price ? " · оптовая цена" : ""}
                </p>
              </div>
              <span className="font-medium whitespace-nowrap tabular-nums">{price(i.total)}</span>
            </li>
          ))}
        </ul>
        <dl className="h-fit space-y-3 rounded-2xl bg-muted/60 p-5 text-sm">
          {o.company ? (
            <div>
              <dt className="text-muted-foreground">Покупатель</dt>
              <dd>{o.company}</dd>
            </div>
          ) : null}
          {o.delivery_method ? (
            <div>
              <dt className="text-muted-foreground">Доставка</dt>
              <dd>{[o.delivery_method, o.city, o.address].filter(Boolean).join(", ")}</dd>
            </div>
          ) : null}
          {o.payment_method ? (
            <div>
              <dt className="text-muted-foreground">Оплата</dt>
              <dd>{o.payment_method}</dd>
            </div>
          ) : null}
          {Number(o.discount) > 0 ? (
            <div className="flex justify-between border-t pt-3">
              <dt className="text-muted-foreground">Скидка</dt>
              <dd>−{price(o.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t pt-3 text-base font-semibold">
            <dt>Итого</dt>
            <dd>{price(o.total)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
