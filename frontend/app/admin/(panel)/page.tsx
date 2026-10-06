"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Inbox, MessageSquareText, Package, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { ErrorBox, Loading, PageHeader, Panel, Pill, useApi } from "@/components/admin/ui";
import { useAdmin } from "@/components/admin/shell";
import { ORDER_STATUS, dateTime, price } from "@/lib/format";
import type { Dashboard } from "@/lib/types";
import { cn } from "@/lib/utils";

function Stat({ icon: Icon, label, value, hint, href, tone }: { icon: typeof Package; label: string; value: React.ReactNode; hint?: string; href?: string; tone?: string }) {
  const body = (
    <div className="flex h-full items-start gap-4 rounded-2xl border bg-card p-5 transition hover:shadow-md">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", tone ?? "bg-primary/10 text-primary")}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-heading text-2xl font-extrabold tabular-nums">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Chart({ data }: { data: Dashboard["chart"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const values = data.map((d) => Number(metric === "revenue" ? d.revenue : d.orders));
  const max = Math.max(1, ...values);
  const h = hover !== null ? data[hover] : null;
  return (
    <Panel
      title="Продажи за 30 дней"
      actions={
        <div className="flex rounded-lg bg-muted p-0.5 text-xs font-medium">
          {(["revenue", "orders"] as const).map((m) => (
            <button key={m} onClick={() => setMetric(m)} className={cn("rounded-md px-2.5 py-1", metric === m ? "bg-background shadow-sm" : "text-muted-foreground")}>
              {m === "revenue" ? "Выручка" : "Заказы"}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-3 h-5 text-sm">
        {h ? (
          <span>
            <span className="text-muted-foreground">{new Date(h.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}:</span>{" "}
            <b>{price(h.revenue)}</b> · {h.orders} заказ(ов)
          </span>
        ) : (
          <span className="text-muted-foreground">Наведите на столбец</span>
        )}
      </div>
      <div className="flex h-48 items-end gap-1" onMouseLeave={() => setHover(null)}>
        {values.map((v, i) => (
          <div key={i} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
            <div
              className={cn("w-full rounded-t-md transition-all", hover === i ? "bg-primary" : "bg-primary/35")}
              style={{ height: `${Math.max(v ? 4 : 1, (v / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{new Date(data[0]?.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
        <span>сегодня</span>
      </div>
    </Panel>
  );
}

export default function DashboardPage() {
  const { user } = useAdmin();
  const { data, error, loading } = useApi<Dashboard>("/admin/dashboard");
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Нет данных"} />;

  return (
    <div className="space-y-6">
      <PageHeader title={`Здравствуйте${user.full_name ? `, ${user.full_name}` : ""}!`} description="Сводка по магазину" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Wallet} label="Выручка за 30 дней" value={price(data.revenue_30d)} hint={`${data.orders_30d} заказов · средний чек ${price(data.avg_check_30d)}`} />
        <Stat icon={ShoppingBag} label="Новые заказы" value={data.orders_new} hint={`всего ${data.orders_total}`} href="/admin/orders?status=new" tone="bg-blue-500/10 text-blue-600" />
        <Stat icon={Inbox} label="Новые заявки" value={data.leads_new} href="/admin/leads" tone="bg-violet-500/10 text-violet-600" />
        <Stat
          icon={Package}
          label="Товары на сайте"
          value={data.products_active}
          hint={`${data.products_out_of_stock} нет в наличии · всего ${data.products_total}`}
          href="/admin/products"
          tone="bg-emerald-500/10 text-emerald-600"
        />
      </div>

      {data.reviews_pending ? (
        <Link href="/admin/reviews" className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <MessageSquareText className="size-5 text-amber-600" />
          {data.reviews_pending} отзыв(ов) ждут модерации
        </Link>
      ) : null}
      {data.last_import?.status === "failed" ? (
        <Link href="/admin/import" className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="size-5" /> Последний импорт завершился с ошибкой: {data.last_import.error}
        </Link>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Chart data={data.chart} />
        <Panel title="Топ товаров за 30 дней">
          {data.top_products.length ? (
            <ol className="space-y-3">
              {data.top_products.map((p, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">{i + 1}</span>
                  <span className="line-clamp-2 flex-1">{p.name}</span>
                  <span className="text-right whitespace-nowrap">
                    <b>{price(p.sum)}</b>
                    <span className="block text-xs text-muted-foreground">{p.qty} шт.</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="size-4" /> Продаж пока нет
            </p>
          )}
        </Panel>
      </div>

      <Panel title="Последние заказы" actions={<Link href="/admin/orders" className="text-sm font-medium text-primary">Все заказы</Link>}>
        {data.recent_orders.length ? (
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {data.recent_orders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/orders/${o.id}`} className="font-mono font-semibold hover:text-primary">
                        {o.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">{o.company || o.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{dateTime(o.created_at)}</td>
                    <td className="px-5 py-3">
                      <Pill tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label}</Pill>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold whitespace-nowrap">{price(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Заказов пока нет</p>
        )}
      </Panel>
    </div>
  );
}
