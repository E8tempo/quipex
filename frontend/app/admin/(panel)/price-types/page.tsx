"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Confirm, Field, Loading, PageHeader, Pill, useApi } from "@/components/admin/ui";
import { apiDelete, apiPost, apiPut } from "@/lib/api-client";
import type { PriceType } from "@/lib/types";

type Draft = Pick<PriceType, "name" | "external_id" | "currency" | "is_default_partner" | "is_active"> & { id?: number };

function Editor({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState(draft);
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{d.id ? "Тип цен" : "Новый тип цен"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Название">
            <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Дилерская" />
          </Field>
          <Field label="Ид в 1С" hint="Классификатор → ТипыЦен → Ид. Заполнится автоматически при обмене">
            <Input value={d.external_id ?? ""} onChange={(e) => setD({ ...d, external_id: e.target.value })} />
          </Field>
          <label className="flex items-center justify-between text-sm">
            <span>
              <span className="font-medium">По умолчанию для партнёров</span>
              <span className="block text-xs text-muted-foreground">Если партнёру не назначен свой тип цен</span>
            </span>
            <Switch checked={d.is_default_partner} onCheckedChange={(v) => setD({ ...d, is_default_partner: v })} />
          </label>
          <label className="flex items-center justify-between text-sm font-medium">
            Активен
            <Switch checked={d.is_active} onCheckedChange={(v) => setD({ ...d, is_active: v })} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={saving || !d.name.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                const body = { ...d, external_id: d.external_id || null };
                if (d.id) await apiPut(`/admin/price-types/${d.id}`, body);
                else await apiPost("/admin/price-types", body);
                onSaved();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Ошибка");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="animate-spin" /> : null} Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PriceTypesPage() {
  const { data, loading, reload } = useApi<PriceType[]>("/admin/price-types");
  const [editing, setEditing] = useState<Draft | null>(null);
  return (
    <div>
      <PageHeader
        title="Типы цен"
        description="Виды цен для партнёров. При обмене с 1С загружаются автоматически вместе с ценами товаров."
        actions={
          <Button onClick={() => setEditing({ name: "", external_id: "", currency: "RUB", is_default_partner: !data?.length, is_active: true })}>
            <Plus /> Добавить
          </Button>
        }
      />
      {loading && !data ? (
        <Loading />
      ) : data?.length ? (
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          {data.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {t.name} {t.is_default_partner ? <Pill tone="bg-accent text-accent-foreground">по умолчанию</Pill> : null}
                  {!t.is_active ? <Pill>выключен</Pill> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.prices_count} цен товаров · {t.customers_count} партнёров{t.external_id ? ` · Ид 1С ${t.external_id}` : ""}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditing({ ...t })}>
                <Pencil />
              </Button>
              <Confirm
                title={`Удалить «${t.name}»?`}
                description="Цены товаров этого типа будут удалены, партнёры перейдут на тип по умолчанию."
                trigger={
                  <Button variant="ghost" size="icon">
                    <Trash2 />
                  </Button>
                }
                onConfirm={async () => {
                  await apiDelete(`/admin/price-types/${t.id}`);
                  reload();
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-muted/60 p-10 text-center text-sm text-muted-foreground">
          Типов цен пока нет. Без них партнёры получают оптовые цены товаров или персональную скидку.
        </div>
      )}
      {editing ? (
        <Editor
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
