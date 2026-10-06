"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Confirm, Loading, PageHeader, Pill, useApi } from "@/components/admin/ui";
import { useAdmin } from "@/components/admin/shell";
import { Stars } from "@/components/shop/product-card";
import { apiDelete, apiPatch } from "@/lib/api-client";
import { dateTime } from "@/lib/format";
import type { AdminReview } from "@/lib/types";

export default function ReviewsPage() {
  const { refreshCounters } = useAdmin();
  const [pending, setPending] = useState(true);
  const { data, setData, loading, reload } = useApi<AdminReview[]>(`/admin/reviews?pending=${pending}`);

  const publish = async (r: AdminReview, value: boolean) => {
    try {
      const upd = await apiPatch<AdminReview>(`/admin/reviews/${r.id}`, { is_published: value });
      setData((d) => d?.map((x) => (x.id === r.id ? { ...upd, product_name: r.product_name } : x)) ?? null);
      refreshCounters();
      toast.success(value ? "Отзыв опубликован" : "Отзыв скрыт");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };

  return (
    <div>
      <PageHeader
        title="Отзывы"
        description="Отзывы покупателей публикуются только после модерации"
        actions={
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={pending} onCheckedChange={setPending} /> Только на модерации
          </label>
        }
      />
      {loading && !data ? (
        <Loading />
      ) : data?.length ? (
        <div className="space-y-3">
          {data.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-5">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <span className="font-semibold">{r.author}</span>
                <Stars value={r.rating} />
                {r.is_published ? <Pill tone="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Опубликован</Pill> : <Pill tone="bg-amber-500/15 text-amber-700 dark:text-amber-300">На модерации</Pill>}
                <span className="ml-auto text-xs text-muted-foreground">{dateTime(r.created_at)}</span>
              </div>
              <Link href={`/admin/products/${r.product_id}`} className="text-sm text-primary hover:underline">
                {r.product_name}
              </Link>
              <p className="mt-2 text-sm whitespace-pre-line">{r.text}</p>
              <div className="mt-4 flex gap-2">
                {r.is_published ? (
                  <Button variant="outline" size="sm" onClick={() => publish(r, false)}>
                    <EyeOff /> Скрыть
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => publish(r, true)}>
                    <Check /> Опубликовать
                  </Button>
                )}
                <Confirm
                  title="Удалить отзыв?"
                  trigger={
                    <Button variant="ghost" size="sm">
                      <Trash2 /> Удалить
                    </Button>
                  }
                  onConfirm={async () => {
                    await apiDelete(`/admin/reviews/${r.id}`);
                    refreshCounters();
                    reload();
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">{pending ? "Нет отзывов на модерации 🎉" : "Отзывов пока нет"}</div>
      )}
    </div>
  );
}
