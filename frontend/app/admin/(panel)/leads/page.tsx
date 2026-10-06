"use client";

import { useState } from "react";
import { ExternalLink, Mail, Phone, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Confirm, Loading, NativeSelect, PageHeader, Pager, Pill, useApi, useDebounced } from "@/components/admin/ui";
import { useAdmin } from "@/components/admin/shell";
import { apiDelete, apiPatch } from "@/lib/api-client";
import { LEAD_STATUS, LEAD_TYPE, dateTime, phoneHref } from "@/lib/format";
import type { Lead, PageResult } from "@/lib/types";
import { cn } from "@/lib/utils";

function LeadCard({ lead, onChange, onDelete }: { lead: Lead; onChange: (l: Lead) => void; onDelete: () => void }) {
  const { refreshCounters } = useAdmin();
  const [note, setNote] = useState(lead.manager_note ?? "");
  const patch = async (body: Partial<Lead>) => {
    try {
      onChange(await apiPatch<Lead>(`/admin/leads/${lead.id}`, body));
      refreshCounters();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };
  return (
    <div className={cn("rounded-2xl border bg-card p-5", lead.status === "new" && "border-primary/40 ring-2 ring-primary/10")}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pill tone="bg-navy text-navy-foreground">{LEAD_TYPE[lead.type]}</Pill>
        <Pill tone={LEAD_STATUS[lead.status]?.tone}>{LEAD_STATUS[lead.status]?.label}</Pill>
        <span className="ml-auto text-xs text-muted-foreground">{dateTime(lead.created_at)}</span>
      </div>
      <p className="font-semibold">
        {lead.name}
        {lead.company ? <span className="font-normal text-muted-foreground"> · {lead.company}</span> : null}
      </p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <a href={phoneHref(lead.phone)} className="flex items-center gap-1.5 text-primary">
          <Phone className="size-3.5" /> {lead.phone}
        </a>
        {lead.email ? (
          <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-primary">
            <Mail className="size-3.5" /> {lead.email}
          </a>
        ) : null}
        {lead.page_url ? (
          <a href={lead.page_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <ExternalLink className="size-3.5" /> страница
          </a>
        ) : null}
      </div>
      {lead.message ? <p className="mt-3 rounded-xl bg-muted p-3 text-sm whitespace-pre-line">{lead.message}</p> : null}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Textarea rows={1} className="min-h-9 flex-1" placeholder="Заметка" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (lead.manager_note ?? "") && patch({ manager_note: note })} />
        <NativeSelect value={lead.status} onChange={(e) => patch({ status: e.target.value as Lead["status"] })}>
          {Object.entries(LEAD_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </NativeSelect>
        <Confirm
          title="Удалить заявку?"
          trigger={
            <Button variant="ghost" size="icon" aria-label="Удалить">
              <Trash2 />
            </Button>
          }
          onConfirm={onDelete}
        />
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const qs = new URLSearchParams({ page: String(page) });
  if (type) qs.set("type", type);
  if (status) qs.set("status", status);
  if (dq) qs.set("q", dq);
  const { data, setData, loading, reload } = useApi<PageResult<Lead>>(`/admin/leads?${qs}`);

  return (
    <div>
      <PageHeader title="Заявки" description="Обратные звонки, оптовые запросы, вопросы и предзаказы" />
      <div className="mb-4 flex flex-wrap gap-2">
        <NativeSelect value={type} onChange={(e) => (setType(e.target.value), setPage(1))}>
          <option value="">Все типы</option>
          {Object.entries(LEAD_TYPE).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
          <option value="">Все статусы</option>
          {Object.entries(LEAD_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </NativeSelect>
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Имя, телефон, компания" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
        </div>
      </div>
      {loading && !data ? (
        <Loading />
      ) : data?.items.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.items.map((l) => (
            <LeadCard
              key={l.id}
              lead={l}
              onChange={(nl) => setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === nl.id ? nl : x)) } : d))}
              onDelete={async () => {
                await apiDelete(`/admin/leads/${l.id}`);
                reload();
              }}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">Заявок нет</div>
      )}
      <Pager page={page} pages={data?.pages ?? 1} onChange={setPage} />
    </div>
  );
}
