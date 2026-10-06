"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, LogOut, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, Loading, NativeSelect, PageHeader, Pager, Pill, useApi, useDebounced } from "@/components/admin/ui";
import { useAdmin } from "@/components/admin/shell";
import { apiPatch, apiPost } from "@/lib/api-client";
import { ORDER_STATUS, dateTime, price } from "@/lib/format";
import type { AdminCustomer, OrderListItem, PageResult, PriceType } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; tone: string }> = {
  none: { label: "Покупатель", tone: "bg-muted text-muted-foreground" },
  pending: { label: "Заявка", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  approved: { label: "Партнёр", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  rejected: { label: "Отклонён", tone: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400" },
};

function CustomerSheet({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const { refreshCounters } = useAdmin();
  const { data: c, setData } = useApi<AdminCustomer>(`/admin/customers/${id}`);
  const { data: types } = useApi<PriceType[]>("/admin/price-types");
  const { data: orders } = useApi<OrderListItem[]>(`/admin/customers/${id}/orders`);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Partial<AdminCustomer>>({});

  const patch = async (body: Record<string, unknown>, msg = "Сохранено") => {
    setBusy(true);
    try {
      setData(await apiPatch<AdminCustomer>(`/admin/customers/${id}`, body));
      setDraft({});
      toast.success(msg);
      refreshCounters();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };
  const v = <K extends keyof AdminCustomer>(k: K) => (k in draft ? draft[k] : c?.[k]) as AdminCustomer[K];

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-b p-5">
          <SheetTitle>{c ? c.company || c.name : "Клиент"}</SheetTitle>
        </SheetHeader>
        {!c ? (
          <Loading />
        ) : (
          <div className="space-y-6 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={STATUS[c.partner_status]?.tone}>{STATUS[c.partner_status]?.label}</Pill>
              {!c.is_active ? <Pill tone="bg-destructive/15 text-destructive">Заблокирован</Pill> : null}
              <span className="ml-auto text-xs text-muted-foreground">с {dateTime(c.created_at)}</span>
            </div>

            {c.partner_status === "pending" ? (
              <div className="space-y-3 rounded-2xl bg-amber-500/10 p-4">
                <p className="text-sm">
                  Заявка на партнёрство: <b>{c.company}</b>, ИНН {c.inn}
                  {c.kpp ? `, КПП ${c.kpp}` : ""}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => patch({ partner_status: "approved" }, "Партнёр одобрен")}>
                    <Check /> Одобрить
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => patch({ partner_status: "rejected" }, "Заявка отклонена")}>
                    <X /> Отклонить
                  </Button>
                </div>
              </div>
            ) : null}

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Контакт</dt>
                <dd>{c.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Телефон</dt>
                <dd>{c.phone ?? "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Email</dt>
                <dd>{c.email}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Заказов</dt>
                <dd>{c.orders_count}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">На сумму</dt>
                <dd>{price(c.orders_total)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Последний вход</dt>
                <dd>{dateTime(c.last_login_at)}</dd>
              </div>
            </dl>

            <div className="grid gap-4 border-t pt-5">
              <p className="font-medium">Партнёрские условия</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Организация">
                  <Input value={v("company") ?? ""} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
                </Field>
                <Field label="ИНН">
                  <Input value={v("inn") ?? ""} onChange={(e) => setDraft({ ...draft, inn: e.target.value })} />
                </Field>
              </div>
              <Field label="Тип цен" hint="Пусто — тип цен «по умолчанию для партнёров»">
                <NativeSelect
                  value={v("price_type_id") ?? ""}
                  onChange={(e) => setDraft({ ...draft, price_type_id: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">— по умолчанию —</option>
                  {types?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.is_default_partner ? " (по умолчанию)" : ""}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Скидка от розницы, %" hint="Применяется к товарам, для которых нет цены по типу">
                <Input
                  inputMode="decimal"
                  value={v("discount_percent") ?? ""}
                  onChange={(e) => setDraft({ ...draft, discount_percent: e.target.value.replace(",", ".") || null })}
                />
              </Field>
              <Field label="Ид контрагента в 1С">
                <Input value={v("external_id") ?? ""} onChange={(e) => setDraft({ ...draft, external_id: e.target.value || null })} />
              </Field>
              <Field label="Заметка менеджера">
                <Textarea rows={2} value={v("manager_note") ?? ""} onChange={(e) => setDraft({ ...draft, manager_note: e.target.value })} />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={busy || !Object.keys(draft).length}
                  onClick={() =>
                    patch({
                      ...draft,
                      ...(draft.discount_percent !== undefined ? { discount_percent: draft.discount_percent ? Number(draft.discount_percent) : null } : {}),
                    })
                  }
                >
                  {busy ? <Loader2 className="animate-spin" /> : null} Сохранить
                </Button>
                {c.partner_status === "approved" ? (
                  <Button variant="ghost" disabled={busy} onClick={() => patch({ partner_status: "rejected" }, "Партнёрский доступ отключён")}>
                    Отключить партнёрство
                  </Button>
                ) : c.partner_status !== "pending" ? (
                  <Button variant="ghost" disabled={busy} onClick={() => patch({ partner_status: "approved", kind: "partner" }, "Партнёр одобрен")}>
                    Сделать партнёром
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t pt-5">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={c.is_active} onCheckedChange={(on) => patch({ is_active: on }, on ? "Доступ восстановлен" : "Клиент заблокирован")} />
                Доступ к кабинету
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await apiPost(`/admin/customers/${id}/logout-all`);
                  toast.success("Все сеансы клиента завершены");
                }}
              >
                <LogOut /> Завершить сеансы
              </Button>
            </div>

            {orders?.length ? (
              <div className="border-t pt-5">
                <p className="mb-2 font-medium">Заказы</p>
                <ul className="divide-y text-sm">
                  {orders.map((o) => (
                    <li key={o.id}>
                      <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-brand">
                        <span className="font-mono">{o.number}</span>
                        <Pill tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label}</Pill>
                        <span className="tabular-nums">{price(o.total)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CustomersInner() {
  const sp = useSearchParams();
  const [kind, setKind] = useState(sp.get("kind") ?? "all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const dq = useDebounced(q);
  const qs = new URLSearchParams({ kind, page: String(page) });
  if (dq) qs.set("q", dq);
  const { data, loading, reload } = useApi<PageResult<AdminCustomer>>(`/admin/customers?${qs}`);

  return (
    <div>
      <PageHeader title="Клиенты" description="Покупатели с личным кабинетом и партнёры с особыми ценами" />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="scrollbar-none flex gap-1 overflow-x-auto rounded-full bg-muted p-1">
          {[
            ["all", "Все"],
            ["pending", "Заявки"],
            ["partner", "Партнёры"],
            ["retail", "Покупатели"],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => (setKind(k), setPage(1))}
              className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm", kind === k ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Имя, email, телефон, компания, ИНН" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        {loading && !data ? (
          <Loading />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Клиент</th>
                <th className="hidden p-3 md:table-cell">Контакты</th>
                <th className="p-3">Статус</th>
                <th className="hidden p-3 lg:table-cell">Тип цен</th>
                <th className="hidden p-3 text-right sm:table-cell">Заказы</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.items.map((c) => (
                <tr key={c.id} className={cn("cursor-pointer hover:bg-muted/40", !c.is_active && "opacity-50")} onClick={() => setOpen(c.id)}>
                  <td className="p-3">
                    <p className="font-medium">{c.company || c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.company ? `${c.name}${c.inn ? ` · ИНН ${c.inn}` : ""}` : c.email}</p>
                  </td>
                  <td className="hidden p-3 text-muted-foreground md:table-cell">
                    {c.phone}
                    <br />
                    <span className="text-xs">{c.email}</span>
                  </td>
                  <td className="p-3">
                    <Pill tone={STATUS[c.partner_status]?.tone}>{STATUS[c.partner_status]?.label}</Pill>
                  </td>
                  <td className="hidden p-3 text-muted-foreground lg:table-cell">
                    {c.is_partner ? (c.price_type_name ?? "по умолчанию") + (c.discount_percent ? ` · −${Number(c.discount_percent)}%` : "") : "—"}
                  </td>
                  <td className="hidden p-3 text-right whitespace-nowrap sm:table-cell">
                    {c.orders_count} · {price(c.orders_total)}
                  </td>
                </tr>
              ))}
              {data && !data.items.length ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-muted-foreground">
                    Никого не найдено
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
      <Pager page={page} pages={data?.pages ?? 1} onChange={setPage} />
      {open ? <CustomerSheet id={open} onClose={() => setOpen(null)} onChanged={reload} /> : null}
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CustomersInner />
    </Suspense>
  );
}
