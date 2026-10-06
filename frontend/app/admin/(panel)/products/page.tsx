"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ExternalLink, Lock, Plus, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { flattenCategories, Loading, NativeSelect, PageHeader, Pager, useApi, useDebounced } from "@/components/admin/ui";
import { ProductImage } from "@/components/shop/product-card";
import { apiPatch, apiPost } from "@/lib/api-client";
import { dateTime, price } from "@/lib/format";
import type { AdminCategory, AdminProductListItem, PageResult } from "@/lib/types";
import { cn } from "@/lib/utils";

function PriceCell({ item, onSaved }: { item: AdminProductListItem; onSaved: (p: AdminProductListItem) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(Math.round(Number(item.price))));
  if (!editing) {
    return (
      <button className="group text-left" onClick={() => setEditing(true)} title="Изменить цену">
        <span className="font-semibold whitespace-nowrap tabular-nums group-hover:text-primary">{price(item.price)}</span>
        {item.old_price ? <span className="block text-xs text-muted-foreground line-through">{price(item.old_price)}</span> : null}
      </button>
    );
  }
  const save = async () => {
    setEditing(false);
    if (Number(value) === Math.round(Number(item.price))) return;
    try {
      onSaved(await apiPatch<AdminProductListItem>(`/admin/products/${item.id}`, { price: Number(value) }));
      toast.success("Цена сохранена и закреплена от перезаписи синхронизацией");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };
  return (
    <Input
      autoFocus
      className="h-8 w-28"
      inputMode="numeric"
      value={value}
      onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

const BULK = [
  { value: "activate", label: "Опубликовать" },
  { value: "deactivate", label: "Снять с публикации" },
  { value: "feature", label: "Отметить как хит" },
  { value: "unfeature", label: "Убрать из хитов" },
  { value: "in_stock", label: "В наличии" },
  { value: "out_of_stock", label: "Нет в наличии" },
  { value: "lock_price", label: "Закрепить цену" },
  { value: "unlock_price", label: "Снять закрепление цены" },
  { value: "price_percent", label: "Изменить цену на %…" },
  { value: "wholesale_percent", label: "Оптовая цена = розница − %…" },
  { value: "move", label: "Переместить в категорию…" },
  { value: "delete", label: "Удалить" },
];

function ProductsInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [status, setStatus] = useState(sp.get("status") ?? "all");
  const [category, setCategory] = useState(sp.get("category_id") ?? "");
  const [sort, setSort] = useState("updated");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [bulk, setBulk] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const dq = useDebounced(q);

  const qs = new URLSearchParams({ page: String(page), per_page: "50", status, sort });
  if (dq) qs.set("q", dq);
  if (category) qs.set("category_id", category);
  const { data, setData, loading, reload } = useApi<PageResult<AdminProductListItem>>(`/admin/products?${qs}`);
  const { data: cats } = useApi<AdminCategory[]>("/admin/categories");

  const replace = (p: AdminProductListItem) => setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === p.id ? p : x)) } : d));
  const patch = async (id: number, body: Partial<AdminProductListItem>) => {
    try {
      replace(await apiPatch<AdminProductListItem>(`/admin/products/${id}`, body));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };
  const runBulk = async () => {
    if (!bulk || !selected.length) return;
    const needsValue = ["price_percent", "wholesale_percent", "move"].includes(bulk);
    if (needsValue && bulkValue === "") return toast.error("Укажите значение");
    if (bulk === "delete" && !window.confirm(`Удалить ${selected.length} товар(ов)?`)) return;
    try {
      const r = await apiPost<{ affected: number }>("/admin/products/bulk", {
        ids: selected,
        action: bulk,
        value: needsValue ? Number(bulkValue) : null,
      });
      toast.success(`Готово: ${r.affected} товар(ов)`);
      setSelected([]);
      setBulk("");
      setBulkValue("");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const items = data?.items ?? [];
  const allChecked = items.length > 0 && items.every((i) => selected.includes(i.id));
  const catOptions = flattenCategories(cats ?? []);

  return (
    <div>
      <PageHeader
        title="Товары"
        description={data ? `${data.total} позиций` : undefined}
        actions={
          <Link href="/admin/products/new" className={buttonVariants()}>
            <Plus /> Добавить товар
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Название, артикул или ID" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
        </div>
        <NativeSelect value={category} onChange={(e) => (setCategory(e.target.value), setPage(1))}>
          <option value="">Все категории</option>
          {catOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {"— ".repeat(c.depth)}
              {c.name} ({c.product_count})
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
          <option value="all">Все</option>
          <option value="active">Опубликованные</option>
          <option value="inactive">Скрытые</option>
          <option value="out_of_stock">Нет в наличии</option>
          <option value="featured">Хиты</option>
          <option value="sale">Со скидкой</option>
          <option value="locked">С ручными правками</option>
        </NativeSelect>
        <NativeSelect value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="updated">Недавно изменённые</option>
          <option value="name">По названию</option>
          <option value="price_asc">Цена ↑</option>
          <option value="price_desc">Цена ↓</option>
          <option value="views">По просмотрам</option>
        </NativeSelect>
      </div>

      {selected.length ? (
        <div className="sticky top-14 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border bg-accent p-3 text-sm lg:top-2">
          <span className="font-semibold">Выбрано: {selected.length}</span>
          <NativeSelect value={bulk} onChange={(e) => setBulk(e.target.value)} className="bg-background">
            <option value="">Действие…</option>
            {BULK.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </NativeSelect>
          {bulk === "price_percent" || bulk === "wholesale_percent" ? (
            <Input className="h-9 w-28 bg-background" placeholder={bulk === "price_percent" ? "+5 или −10" : "10"} value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} />
          ) : null}
          {bulk === "move" ? (
            <NativeSelect value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="bg-background">
              <option value="">Категория…</option>
              {catOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {"— ".repeat(c.depth)}
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          ) : null}
          <Button size="sm" onClick={runBulk} disabled={!bulk}>
            Применить
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Сбросить
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border bg-card">
        {loading && !data ? (
          <Loading />
        ) : (
          <table className={cn("w-full text-sm transition-opacity lg:min-w-[56rem]", loading && "opacity-60")}>
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-10 p-3">
                  <Checkbox checked={allChecked} onCheckedChange={(v) => setSelected(v ? items.map((i) => i.id) : [])} />
                </th>
                <th className="p-3">Товар</th>
                <th className="hidden p-3 lg:table-cell">Категория</th>
                <th className="p-3">Цена</th>
                <th className="hidden p-3 md:table-cell">Опт</th>
                <th className="hidden p-3 text-center sm:table-cell">Наличие</th>
                <th className="p-3 text-center">На сайте</th>
                <th className="hidden p-3 xl:table-cell">Обновлён</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((p) => (
                <tr key={p.id} className={cn("hover:bg-muted/40", !p.is_active && "opacity-60")}>
                  <td className="p-3">
                    <Checkbox
                      checked={selected.includes(p.id)}
                      onCheckedChange={(v) => setSelected((s) => (v ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <span className="img-tile size-12 shrink-0 overflow-hidden rounded-lg p-0.5">
                        <ProductImage src={p.image} alt="" />
                      </span>
                      <div className="min-w-0">
                        <Link href={`/admin/products/${p.id}`} className="line-clamp-2 font-medium hover:text-primary">
                          {p.name}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>#{p.id}</span>
                          {p.sku ? <span>арт. {p.sku}</span> : null}
                          {p.is_featured ? <Star className="size-3 fill-amber-400 text-amber-400" /> : null}
                          {p.price_locked || p.content_locked ? (
                            <span title={p.price_locked ? "Цена закреплена" : "Контент закреплён"}>
                              <Lock className="size-3" />
                            </span>
                          ) : null}
                          <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className="hover:text-foreground" title="Открыть на сайте">
                            <ExternalLink className="size-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden p-3 text-muted-foreground lg:table-cell">{p.category?.name ?? "—"}</td>
                  <td className="p-3">
                    <PriceCell item={p} onSaved={replace} />
                  </td>
                  <td className="hidden p-3 whitespace-nowrap text-muted-foreground tabular-nums md:table-cell">{p.wholesale_price ? price(p.wholesale_price) : "—"}</td>
                  <td className="hidden p-3 text-center sm:table-cell">
                    <Switch checked={p.in_stock} onCheckedChange={(v) => patch(p.id, { in_stock: v })} />
                  </td>
                  <td className="p-3 text-center">
                    <Switch checked={p.is_active} onCheckedChange={(v) => patch(p.id, { is_active: v })} />
                  </td>
                  <td className="hidden p-3 text-xs whitespace-nowrap text-muted-foreground xl:table-cell">{dateTime(p.updated_at)}</td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-muted-foreground">
                    Товары не найдены
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
      <Pager page={page} pages={data?.pages ?? 1} onChange={(p) => (setPage(p), router.refresh())} />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ProductsInner />
    </Suspense>
  );
}
