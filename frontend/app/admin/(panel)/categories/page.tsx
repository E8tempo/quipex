"use client";

import { useRef, useState } from "react";
import { ExternalLink, EyeOff, ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Confirm, Field, Loading, NativeSelect, PageHeader, flattenCategories, useApi } from "@/components/admin/ui";
import { apiDelete, apiPost, apiPut, apiUpload } from "@/lib/api-client";
import type { AdminCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

type Draft = Omit<AdminCategory, "id" | "product_count" | "source_url"> & { id?: number };

const EMPTY: Draft = {
  name: "",
  slug: "",
  parent_id: null,
  description: "",
  image: null,
  cover: null,
  sort_order: 500,
  is_active: true,
  meta_title: "",
  meta_description: "",
};

function Editor({ draft, cats, onClose, onSaved }: { draft: Draft; cats: AdminCategory[]; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const options = flattenCategories(cats).filter((c) => c.id !== d.id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{d.id ? "Редактировать категорию" : "Новая категория"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Название *">
            <Input value={d.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Родительская категория">
              <NativeSelect value={d.parent_id ?? ""} onChange={(e) => set("parent_id", e.target.value ? Number(e.target.value) : null)}>
                <option value="">— верхний уровень —</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {"— ".repeat(c.depth)}
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Адрес (slug)">
              <Input value={d.slug} onChange={(e) => set("slug", e.target.value)} placeholder="авто" />
            </Field>
            <Field label="Сортировка" hint="Меньше — выше">
              <Input inputMode="numeric" value={d.sort_order} onChange={(e) => set("sort_order", Number(e.target.value.replace(/\D/g, "")) || 0)} />
            </Field>
            <Field label="Обложка" hint="По умолчанию — фото товара из категории">
              <div className="flex items-center gap-2">
                <span className="img-tile flex size-12 items-center justify-center overflow-hidden rounded-lg">
                  {d.cover ? <img src={d.cover} alt="" className="size-10 object-contain" /> : null}
                </span>
                <Button variant="outline" size="sm" onClick={() => file.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} Загрузить
                </Button>
                {d.cover ? (
                  <Button variant="ghost" size="sm" onClick={() => set("cover", null)}>
                    Убрать
                  </Button>
                ) : null}
                <input
                  ref={file}
                  type="file"
                  accept="image/*,.svg"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    setUploading(true);
                    try {
                      const r = await apiUpload<{ url: string }>("/admin/categories/upload-image", f);
                      set("cover", r.url);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Ошибка");
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </div>
            </Field>
          </div>
          <Field label="Описание (HTML, выводится под списком товаров)">
            <Textarea rows={4} value={d.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="SEO Title">
            <Input value={d.meta_title ?? ""} onChange={(e) => set("meta_title", e.target.value)} />
          </Field>
          <Field label="SEO Description">
            <Textarea rows={2} value={d.meta_description ?? ""} onChange={(e) => set("meta_description", e.target.value)} />
          </Field>
          <label className="flex items-center justify-between text-sm font-medium">
            Показывать на сайте
            <Switch checked={d.is_active} onCheckedChange={(v) => set("is_active", v)} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              if (!d.name.trim()) return toast.error("Укажите название");
              setSaving(true);
              const payload = { ...d, slug: d.slug || null, description: d.description || null, meta_title: d.meta_title || null, meta_description: d.meta_description || null };
              try {
                if (d.id) await apiPut(`/admin/categories/${d.id}`, payload);
                else await apiPost("/admin/categories", payload);
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

export default function CategoriesPage() {
  const { data, loading, reload } = useApi<AdminCategory[]>("/admin/categories");
  const [editing, setEditing] = useState<Draft | null>(null);
  const rows = flattenCategories(data ?? []);

  return (
    <div>
      <PageHeader
        title="Категории"
        description="Дерево каталога. Категории без товаров автоматически скрываются из меню сайта."
        actions={
          <Button onClick={() => setEditing({ ...EMPTY })}>
            <Plus /> Добавить
          </Button>
        }
      />
      {loading && !data ? (
        <Loading />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <ul className="divide-y">
            {rows.map((c) => (
              <li key={c.id} className={cn("flex items-center gap-3 px-4 py-3 hover:bg-muted/40", !c.is_active && "opacity-55")}>
                <span style={{ width: c.depth * 24 }} className="shrink-0" />
                <span className="img-tile flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  {c.cover || c.image ? <img src={(c.cover || c.image)!} alt="" className="size-8 object-contain" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-medium", c.depth === 0 && "font-semibold")}>
                    {c.name} {!c.is_active ? <EyeOff className="ml-1 inline size-3.5" /> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    /{c.slug} · {c.product_count} товаров · сорт. {c.sort_order}
                    {c.source_url ? " · из e8.ru" : ""}
                  </p>
                </div>
                <a href={`/catalog/${c.slug}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Открыть на сайте">
                  <ExternalLink className="size-4" />
                </a>
                <Button variant="ghost" size="icon" onClick={() => setEditing({ ...c })} aria-label="Редактировать">
                  <Pencil />
                </Button>
                <Confirm
                  title={`Удалить «${c.name}»?`}
                  description="Товары и подкатегории будут перенесены в родительскую категорию."
                  trigger={
                    <Button variant="ghost" size="icon" aria-label="Удалить">
                      <Trash2 />
                    </Button>
                  }
                  onConfirm={async () => {
                    await apiDelete(`/admin/categories/${c.id}`);
                    toast.success("Категория удалена");
                    reload();
                  }}
                />
              </li>
            ))}
            {!rows.length ? <li className="p-10 text-center text-muted-foreground">Категорий нет — запустите импорт или добавьте вручную</li> : null}
          </ul>
        </div>
      )}
      {editing ? (
        <Editor
          draft={editing}
          cats={data ?? []}
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
