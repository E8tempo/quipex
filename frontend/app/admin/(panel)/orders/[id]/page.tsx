"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Building2, Loader2, Mail, MapPin, Phone, Printer, Trash2, Truck, User, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Confirm, ErrorBox, Loading, Panel, Pill, useApi } from "@/components/admin/ui";
import { useAdmin } from "@/components/admin/shell";
import { ProductImage } from "@/components/shop/product-card";
import { apiDelete, apiPatch } from "@/lib/api-client";
import { ORDER_STATUS, dateTime, phoneHref, price } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { refreshCounters } = useAdmin();
  const { data: order, setData, error } = useApi<Order>(`/admin/orders/${id}`);
  const [note, setNote] = useState<string | null>(null);
  const [discount, setDiscount] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (error) return <ErrorBox message={error} />;
  if (!order) return <Loading />;

  const update = async (body: Record<string, unknown>, msg = "Сохранено") => {
    setSaving(true);
    try {
      setData(await apiPatch<Order>(`/admin/orders/${id}`, body));
      toast.success(msg);
      refreshCounters();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const info = [
    { icon: order.customer_type === "wholesale" ? Building2 : User, label: order.customer_type === "wholesale" ? "Юр. лицо" : "Физ. лицо", value: [order.company, order.inn ? `ИНН ${order.inn}` : null, order.name].filter(Boolean).join(" · ") },
    { icon: Phone, label: "Телефон", value: order.phone, href: phoneHref(order.phone) },
    order.email ? { icon: Mail, label: "Email", value: order.email, href: `mailto:${order.email}` } : null,
    order.city || order.address ? { icon: MapPin, label: "Адрес", value: [order.city, order.address].filter(Boolean).join(", ") } : null,
    order.delivery_method ? { icon: Truck, label: "Доставка", value: order.delivery_method } : null,
    order.payment_method ? { icon: Wallet, label: "Оплата", value: order.payment_method } : null,
  ].filter(Boolean) as { icon: typeof User; label: string; value: string; href?: string }[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders" className="rounded-lg border p-2 hover:bg-muted" aria-label="Назад">
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-extrabold">Заказ № {order.number}</h1>
            <p className="text-sm text-muted-foreground">от {dateTime(order.created_at)}</p>
          </div>
          <Pill tone={ORDER_STATUS[order.status]?.tone}>{ORDER_STATUS[order.status]?.label}</Pill>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Печать
          </Button>
          <Confirm
            title="Удалить заказ?"
            description="Действие необратимо."
            trigger={
              <Button variant="destructive">
                <Trash2 />
              </Button>
            }
            onConfirm={async () => {
              await apiDelete(`/admin/orders/${id}`);
              toast.success("Заказ удалён");
              refreshCounters();
              router.replace("/admin/orders");
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => (
          <button
            key={s}
            disabled={saving || s === order.status}
            onClick={() => update({ status: s }, `Статус: ${ORDER_STATUS[s].label}`)}
            className={cn(
              "rounded-xl border px-3.5 py-2 text-sm font-medium transition",
              s === order.status ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {ORDER_STATUS[s].label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Panel title={`Состав заказа (${order.items.length})`}>
          <ul className="-my-3 divide-y">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-center gap-4 py-3">
                <span className="size-14 shrink-0 overflow-hidden rounded-lg border bg-white p-1">
                  <ProductImage src={it.image} alt="" />
                </span>
                <div className="min-w-0 flex-1">
                  {it.product_id ? (
                    <Link href={`/admin/products/${it.product_id}`} className="line-clamp-2 text-sm font-medium hover:text-primary">
                      {it.name}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium">{it.name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {it.sku ? `арт. ${it.sku} · ` : ""}
                    {price(it.price)} × {it.quantity}
                    {it.is_wholesale_price ? <span className="ml-1 font-medium text-success">опт</span> : null}
                  </p>
                </div>
                <span className="font-semibold whitespace-nowrap">{price(it.total)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Сумма товаров</span>
              <span>{price(order.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 print:hidden">
              <span className="text-muted-foreground">Скидка менеджера, ₽</span>
              <Input
                className="h-8 w-32 text-right"
                inputMode="numeric"
                value={discount ?? String(Math.round(Number(order.discount)))}
                onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ""))}
                onBlur={() => {
                  if (discount !== null && Number(discount) !== Number(order.discount)) update({ discount: Number(discount || 0) });
                  setDiscount(null);
                }}
              />
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Итого</span>
              <span>{price(order.total)}</span>
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Покупатель">
            <ul className="space-y-3 text-sm">
              {info.map((r) => (
                <li key={r.label} className="flex gap-3">
                  <r.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{r.label}</p>
                    {r.href ? (
                      <a href={r.href} className="font-medium break-words hover:text-primary">
                        {r.value}
                      </a>
                    ) : (
                      <p className="font-medium break-words">{r.value}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {order.comment ? (
              <div className="mt-4 rounded-xl bg-muted p-3 text-sm">
                <p className="mb-1 text-xs text-muted-foreground">Комментарий покупателя</p>
                {order.comment}
              </div>
            ) : null}
          </Panel>
          <Panel title="Заметка менеджера" className="print:hidden">
            <Textarea rows={4} value={note ?? order.manager_note ?? ""} onChange={(e) => setNote(e.target.value)} placeholder="Видна только в админке" />
            <Button className="mt-3" size="sm" disabled={saving || note === null} onClick={() => update({ manager_note: note }).then(() => setNote(null))}>
              {saving ? <Loader2 className="animate-spin" /> : null} Сохранить заметку
            </Button>
          </Panel>
        </div>
      </div>
    </div>
  );
}
