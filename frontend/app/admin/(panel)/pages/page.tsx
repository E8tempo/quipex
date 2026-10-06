"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Confirm, Field, Loading, PageHeader, Pill, useApi } from "@/components/admin/ui";
import { apiDelete, apiPost, apiPut } from "@/lib/api-client";
import type { ContentPage } from "@/lib/types";

type Draft = Omit<ContentPage, "id" | "updated_at"> & { id?: number };
const EMPTY: Draft = { slug: "", title: "", content: "", is_published: true, show_in_footer: true, sort_order: 500, meta_description: "" };

function Editor({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState(draft);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{d.id ? "Редактировать страницу" : "Новая страница"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label="Заголовок *">
              <Input value={d.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Адрес *" hint={`/info/${d.slug || "..."}`}>
              <Input value={d.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
            </Field>
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Содержимое (HTML)</span>
              <button className="text-sm text-primary" onClick={() => setPreview(!preview)}>
                {preview ? "Редактировать" : "Предпросмотр"}
              </button>
            </div>
            {preview ? (
              <div className="prose-content min-h-60 rounded-xl border p-4" dangerouslySetInnerHTML={{ __html: d.content }} />
            ) : (
              <Textarea rows={14} className="font-mono text-xs" value={d.content} onChange={(e) => set("content", e.target.value)} />
            )}
          </div>
          <Field label="SEO Description">
            <Textarea rows={2} value={d.meta_description ?? ""} onChange={(e) => set("meta_description", e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2">
              <Switch checked={d.is_published} onCheckedChange={(v) => set("is_published", v)} /> Опубликована
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={d.show_in_footer} onCheckedChange={(v) => set("show_in_footer", v)} /> В подвале сайта
            </label>
            <label className="flex items-center gap-2">
              Порядок
              <Input className="h-8 w-20" inputMode="numeric" value={d.sort_order} onChange={(e) => set("sort_order", Number(e.target.value.replace(/\D/g, "")) || 0)} />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                const body = { ...d, meta_description: d.meta_description || null };
                if (d.id) await apiPut(`/admin/pages/${d.id}`, body);
                else await apiPost("/admin/pages", body);
                toast.success("Сохранено");
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

export default function PagesAdmin() {
  const { data, loading, reload } = useApi<ContentPage[]>("/admin/pages");
  const [editing, setEditing] = useState<Draft | null>(null);
  return (
    <div>
      <PageHeader
        title="Страницы"
        description="Доставка, оплата, гарантия, о компании и любые другие информационные страницы"
        actions={
          <Button onClick={() => setEditing({ ...EMPTY })}>
            <Plus /> Добавить
          </Button>
        }
      />
      {loading && !data ? (
        <Loading />
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          {data?.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground">/info/{p.slug}</p>
              </div>
              {!p.is_published ? <Pill>Черновик</Pill> : null}
              <a href={`/info/${p.slug}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
                <ExternalLink className="size-4" />
              </a>
              <Button variant="ghost" size="icon" onClick={() => setEditing({ ...p })}>
                <Pencil />
              </Button>
              <Confirm
                title={`Удалить «${p.title}»?`}
                trigger={
                  <Button variant="ghost" size="icon">
                    <Trash2 />
                  </Button>
                }
                onConfirm={async () => {
                  await apiDelete(`/admin/pages/${p.id}`);
                  reload();
                }}
              />
            </div>
          ))}
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
