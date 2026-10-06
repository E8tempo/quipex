"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Download, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loading, PageHeader, Pager, Pill, useApi, useDebounced } from "@/components/admin/ui";
import { ORDER_STATUS, dateTime, price } from "@/lib/format";
import type { OrderListItem, PageResult } from "@/lib/types";
import { cn } from "@/lib/utils";

function OrdersInner() {
  const sp = useSearchParams();
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const qs = new URLSearchParams({ page: String(page) });
  if (status) qs.set("status", status);
  if (dq) qs.set("q", dq);
  const { data, loading } = useApi<PageResult<OrderListItem>>(`/admin/orders?${qs}`);
  const exportQs = new URLSearchParams();
  if (status) exportQs.set("status", status);
  if (dq) exportQs.set("q", dq);

  return (
    <div>
      <PageHeader
        title="Заказы"
        description={data ? `Найдено: ${data.total}` : undefined}
        actions={
          <a href={`/api/admin/orders/export.csv?${exportQs}`} className={buttonVariants({ variant: "outline" })}>
            <Download /> Экспорт CSV
          </a>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="scrollbar-none flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
          {[["", "Все"], ...Object.entries(ORDER_STATUS).map(([k, v]) => [k, v.label])].map(([k, label]) => (
            <button
              key={k}
              onClick={() => (setStatus(k), setPage(1))}
              className={cn("shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium", status === k ? "bg-background shadow-sm" : "text-muted-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Номер, имя, телефон, компания" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        {loading && !data ? (
          <Loading />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Номер</th>
                <th className="hidden p-3 md:table-cell">Дата</th>
                <th className="p-3">Клиент</th>
                <th className="hidden p-3 lg:table-cell">Тип</th>
                <th className="p-3">Статус</th>
                <th className="p-3 text-right">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.items.map((o) => (
                <tr key={o.id} className="hover:bg-muted/40">
                  <td className="p-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono font-semibold hover:text-primary">
                      {o.number}
                    </Link>
                  </td>
                  <td className="hidden p-3 whitespace-nowrap text-muted-foreground md:table-cell">{dateTime(o.created_at)}</td>
                  <td className="p-3">
                    <Link href={`/admin/orders/${o.id}`} className="block">
                      <span className="font-medium">{o.company || o.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {o.phone} · {o.items_count} шт.
                      </span>
                    </Link>
                  </td>
                  <td className="hidden p-3 lg:table-cell">{o.customer_type === "wholesale" ? <Pill tone="bg-navy text-navy-foreground">Юр. лицо</Pill> : <Pill>Физ. лицо</Pill>}</td>
                  <td className="p-3">
                    <Pill tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label}</Pill>
                  </td>
                  <td className="p-3 text-right font-semibold whitespace-nowrap">{price(o.total)}</td>
                </tr>
              ))}
              {data && !data.items.length ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-muted-foreground">
                    Заказов нет
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
      <Pager page={page} pages={data?.pages ?? 1} onChange={setPage} />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OrdersInner />
    </Suspense>
  );
}
