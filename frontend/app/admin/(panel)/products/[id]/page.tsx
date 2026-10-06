"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, ImagePlus, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Confirm, ErrorBox, Field, Loading, NativeSelect, Panel, flattenCategories, useApi } from "@/components/admin/ui";
import { apiDelete, apiPost, apiPut, apiUpload } from "@/lib/api-client";
import { dateTime, price } from "@/lib/format";
import type { AdminCategory, AdminProduct, Attribute, DocumentItem, ImageItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FormState {
  name: string;
  slug: string;
  category_id: string;
  sku: string;
  brand: string;
  short_description: string;
  description: string;
  price: string;
  old_price: string;
  wholesale_price: string;
  price_locked: boolean;
  content_locked: boolean;
  in_stock: boolean;
  stock_qty: string;
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  sort_order: string;
  meta_title: string;
  meta_description: string;
  attributes: Attribute[];
  highlights: Attribute[];
  documents: DocumentItem[];
}

const EMPTY: FormState = {
  name: "",
  slug: "",
  category_id: "",
  sku: "",
  brand: "",
  short_description: "",
  description: "",
  price: "",
  old_price: "",
  wholesale_price: "",
  price_locked: false,
  content_locked: false,
  in_stock: true,
  stock_qty: "",
  is_active: true,
  is_featured: false,
  is_new: false,
  sort_order: "500",
  meta_title: "",
  meta_description: "",
  attributes: [],
  highlights: [],
  documents: [],
};

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const money = (v: unknown) => (v === null || v === undefined || v === "" ? "" : String(Math.round(Number(v))));

function fromProduct(p: AdminProduct): FormState {
  return {
    name: p.name,
    slug: p.slug,
    category_id: s(p.category_id),
    sku: s(p.sku),
    brand: s(p.brand),
    short_description: s(p.short_description),
    description: s(p.description),
    price: money(p.price),
    old_price: money(p.old_price),
    wholesale_price: money(p.wholesale_price),
    price_locked: p.price_locked,
    content_locked: p.content_locked,
    in_stock: p.in_stock,
    stock_qty: s(p.stock_qty),
    is_active: p.is_active,
    is_featured: p.is_featured,
    is_new: p.is_new,
    sort_order: s(p.sort_order),
    meta_title: s(p.meta_title),
    meta_description: s(p.meta_description),
    attributes: p.attributes.map((a) => ({ group: a.group ?? "", name: a.name, value: a.value })),
    highlights: (p.highlights ?? []).map((a) => ({ name: a.name, value: a.value })),
    documents: p.documents ?? [],
  };
}

function toPayload(f: FormState) {
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    ...f,
    slug: f.slug || null,
    category_id: num(f.category_id),
    sku: f.sku || null,
    brand: f.brand || null,
    short_description: f.short_description || null,
    description: f.description || null,
    price: Number(f.price || 0),
    old_price: num(f.old_price),
    wholesale_price: num(f.wholesale_price),
    stock_qty: num(f.stock_qty),
    sort_order: Number(f.sort_order || 500),
    meta_title: f.meta_title || null,
    meta_description: f.meta_description || null,
    attributes: f.attributes.filter((a) => a.name.trim() && a.value.trim()).map((a) => ({ ...a, group: a.group || null })),
    highlights: f.highlights.filter((a) => a.name.trim() && a.value.trim()),
    documents: f.documents.filter((d) => d.url.trim()),
  };
}

function PartnerPrices({ productId }: { productId: number }) {
  const { data, setData } = useApi<{ price_type_id: number; price_type_name: string; price: string | null }[]>(
    `/admin/products/${productId}/prices`,
  );
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  if (!data) return null;
  if (!data.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Типов цен нет. Создайте их в разделе <Link href="/admin/price-types" className="underline">«Типы цен»</Link> или загрузите из 1С.
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      {data.map((r) => (
        <Field key={r.price_type_id} label={`${r.price_type_name}, ₽`}>
          <Input
            inputMode="numeric"
            placeholder="не задана"
            value={draft[r.price_type_id] ?? money(r.price)}
            onChange={(e) => setDraft({ ...draft, [r.price_type_id]: e.target.value.replace(/[^\d.]/g, "") })}
          />
        </Field>
      ))}
      <Button
        variant="secondary"
        size="sm"
        className="w-fit"
        disabled={saving || !Object.keys(draft).length}
        onClick={async () => {
          setSaving(true);
          try {
            setData(
              await apiPut(
                `/admin/products/${productId}/prices`,
                Object.entries(draft).map(([id, v]) => ({ price_type_id: Number(id), price: v ? Number(v) : null })),
              ),
            );
            setDraft({});
            toast.success("Цены сохранены");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Ошибка");
          } finally {
            setSaving(false);
          }
        }}
      >
        Сохранить цены
      </Button>
      <p className="text-xs text-muted-foreground">При обмене с 1С эти цены будут обновляться автоматически.</p>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function AttrEditor({ rows, onChange, withGroup }: { rows: Attribute[]; onChange: (r: Attribute[]) => void; withGroup?: boolean }) {
  const set = (i: number, k: keyof Attribute, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className={cn("grid gap-2", withGroup ? "grid-cols-[1fr_1.2fr_1.5fr_auto]" : "grid-cols-[1fr_1.5fr_auto]")}>
          {withGroup ? <Input placeholder="Группа" value={r.group ?? ""} onChange={(e) => set(i, "group", e.target.value)} /> : null}
          <Input placeholder="Название" value={r.name} onChange={(e) => set(i, "name", e.target.value)} />
          <Input placeholder="Значение" value={r.value} onChange={(e) => set(i, "value", e.target.value)} />
          <Button variant="ghost" size="icon" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Удалить">
            <X />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, { group: withGroup ? (rows[rows.length - 1]?.group ?? "") : undefined, name: "", value: "" }])}
      >
        <Plus /> Добавить строку
      </Button>
    </div>
  );
}

function Gallery({ productId, images, onChange }: { productId: number; images: ImageItem[]; onChange: (i: ImageItem[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const move = async (i: number, dir: -1 | 1) => {
    const next = [...images];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    try {
      onChange(await apiPut<ImageItem[]>(`/admin/products/${productId}/images/order`, { ids: next.map((x) => x.id) }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
        {images.map((img, i) => (
          <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl border bg-white">
            <img src={img.url} alt="" className="size-full object-contain p-2" />
            {i === 0 ? <span className="absolute top-1.5 left-1.5 rounded bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">Главное</span> : null}
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/50 p-1.5 opacity-0 transition group-hover:opacity-100">
              <button className="rounded bg-white/90 p-1 text-zinc-800" onClick={() => move(i, -1)} aria-label="Левее">
                <ArrowUp className="size-3.5 -rotate-90" />
              </button>
              <button className="rounded bg-white/90 p-1 text-zinc-800" onClick={() => move(i, 1)} aria-label="Правее">
                <ArrowDown className="size-3.5 -rotate-90" />
              </button>
              <button
                className="rounded bg-white/90 p-1 text-red-600"
                aria-label="Удалить"
                onClick={async () => {
                  try {
                    await apiDelete(`/admin/products/${productId}/images/${img.id}`);
                    onChange(images.filter((x) => x.id !== img.id));
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Ошибка");
                  }
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={() => input.current?.click()}
          disabled={uploading}
          className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          {uploading ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
          Загрузить
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (!files.length) return;
          setUploading(true);
          try {
            onChange(await apiUpload<ImageItem[]>(`/admin/products/${productId}/images`, files, "files"));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Ошибка загрузки");
          } finally {
            setUploading(false);
          }
        }}
      />
      <p className="text-xs text-muted-foreground">Фото автоматически сжимаются в WebP. Первое фото — главное в карточке.</p>
    </div>
  );
}

export default function ProductEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === "new";
  const { data: product, error, setData: setProduct } = useApi<AdminProduct>(isNew ? null : `/admin/products/${params.id}`);
  const { data: cats } = useApi<AdminCategory[]>("/admin/categories");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  if (product && product.id !== loadedId) {
    setForm(fromProduct(product));
    setLoadedId(product.id);
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const inp = (k: keyof FormState) => ({
    value: form[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
  });

  if (!isNew && error) return <ErrorBox message={error} />;
  if (!isNew && !product) return <Loading />;

  const save = async () => {
    if (!form.name.trim()) return toast.error("Укажите название");
    setSaving(true);
    try {
      const payload = toPayload(form);
      if (isNew) {
        const created = await apiPost<AdminProduct>("/admin/products", payload);
        toast.success("Товар создан — теперь можно загрузить фото");
        router.replace(`/admin/products/${created.id}`);
      } else {
        const updated = await apiPut<AdminProduct>(`/admin/products/${params.id}`, payload);
        setProduct(updated);
        setForm(fromProduct(updated));
        toast.success("Сохранено");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-24">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/admin/products" className="rounded-lg border p-2 hover:bg-muted" aria-label="Назад">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-xl font-extrabold sm:text-2xl">{isNew ? "Новый товар" : form.name || "Товар"}</h1>
            {product ? (
              <p className="text-xs text-muted-foreground">
                #{product.id} · обновлён {dateTime(product.updated_at)}
                {product.synced_at ? ` · синхронизирован ${dateTime(product.synced_at)}` : ""} · {product.views} просмотров
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          {product ? (
            <a href={`/product/${product.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-muted">
              <ExternalLink className="size-4" /> На сайте
            </a>
          ) : null}
          {product ? (
            <Confirm
              title="Удалить товар?"
              description="Товар и его фото будут удалены безвозвратно. Если он импортирован с e8.ru, при следующей синхронизации он появится снова — лучше просто снять с публикации."
              trigger={
                <Button variant="destructive">
                  <Trash2 /> Удалить
                </Button>
              }
              onConfirm={async () => {
                await apiDelete(`/admin/products/${product.id}`);
                toast.success("Товар удалён");
                router.replace("/admin/products");
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Panel title="Основное">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Название *" className="sm:col-span-2">
                <Input {...inp("name")} />
              </Field>
              <Field label="Категория">
                <NativeSelect value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
                  <option value="">— без категории —</option>
                  {flattenCategories(cats ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {"— ".repeat(c.depth)}
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Адрес (slug)" hint="Оставьте пустым — сгенерируется из названия">
                <Input {...inp("slug")} />
              </Field>
              <Field label="Артикул">
                <Input {...inp("sku")} />
              </Field>
              <Field label="Бренд">
                <Input {...inp("brand")} />
              </Field>
            </div>
          </Panel>

          {product ? (
            <Panel title={`Фотографии (${product.gallery.length})`}>
              <Gallery productId={product.id} images={product.gallery} onChange={(g) => setProduct({ ...product, gallery: g })} />
            </Panel>
          ) : (
            <Panel title="Фотографии">
              <p className="text-sm text-muted-foreground">Сохраните товар, чтобы загрузить фотографии.</p>
            </Panel>
          )}

          <Panel
            title="Описание"
            actions={
              <button className="text-sm text-primary" onClick={() => setPreview(!preview)}>
                {preview ? "Редактировать" : "Предпросмотр"}
              </button>
            }
          >
            {preview ? (
              <div className="prose-content min-h-40 rounded-xl border p-4" dangerouslySetInnerHTML={{ __html: form.description }} />
            ) : (
              <Textarea rows={12} className="font-mono text-xs" placeholder="<p>Описание товара. Поддерживается HTML.</p>" {...inp("description")} />
            )}
          </Panel>

          <Panel title="Ключевые параметры (в карточке каталога)">
            <AttrEditor rows={form.highlights} onChange={(r) => set("highlights", r)} />
          </Panel>

          <Panel title={`Характеристики (${form.attributes.length})`}>
            <p className="mb-3 text-xs text-muted-foreground">Используются в таблице характеристик, сравнении и фильтрах каталога.</p>
            <AttrEditor rows={form.attributes} onChange={(r) => set("attributes", r)} withGroup />
          </Panel>

          <Panel title="Документы">
            <div className="space-y-2">
              {form.documents.map((d, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
                  <Input
                    placeholder="Название"
                    value={d.title}
                    onChange={(e) => set("documents", form.documents.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                  />
                  <Input
                    placeholder="Ссылка на PDF"
                    value={d.url}
                    onChange={(e) => set("documents", form.documents.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                  />
                  <Button variant="ghost" size="icon" onClick={() => set("documents", form.documents.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => set("documents", [...form.documents, { title: "", url: "" }])}>
                <Plus /> Добавить документ
              </Button>
            </div>
          </Panel>

          <Panel title="SEO">
            <div className="grid gap-4">
              <Field label="Title">
                <Input {...inp("meta_title")} placeholder={form.name} />
              </Field>
              <Field label="Description">
                <Textarea rows={3} {...inp("meta_description")} />
              </Field>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Цены">
            <div className="grid gap-4">
              <Field label="Розничная цена, ₽ *">
                <Input inputMode="numeric" {...inp("price")} />
              </Field>
              <Field label="Старая цена, ₽" hint="Если больше текущей — показывается скидка">
                <Input inputMode="numeric" {...inp("old_price")} />
              </Field>
              <Field label="Оптовая цена, ₽">
                <Input inputMode="numeric" {...inp("wholesale_price")} />
              </Field>
              {product?.source_price ? (
                <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Цена на e8.ru: <b className="text-foreground">{price(product.source_price)}</b>
                </p>
              ) : null}
              <Toggle
                label="Закрепить цены"
                hint="Синхронизация не будет перезаписывать цены"
                checked={form.price_locked}
                onChange={(v) => set("price_locked", v)}
              />
            </div>
          </Panel>
          {product ? (
            <Panel title="Цены для партнёров">
              <PartnerPrices productId={product.id} />
            </Panel>
          ) : null}
          <Panel title="Публикация и склад">
            <div className="divide-y">
              <Toggle label="Опубликован на сайте" checked={form.is_active} onChange={(v) => set("is_active", v)} />
              <Toggle label="В наличии" checked={form.in_stock} onChange={(v) => set("in_stock", v)} />
              <Toggle label="Хит продаж" hint="Показывается на главной" checked={form.is_featured} onChange={(v) => set("is_featured", v)} />
              <Toggle label="Новинка" checked={form.is_new} onChange={(v) => set("is_new", v)} />
              {product?.source_url ? (
                <Toggle
                  label="Не обновлять контент при синхронизации"
                  hint="Название, описание, фото и характеристики останутся вашими"
                  checked={form.content_locked}
                  onChange={(v) => set("content_locked", v)}
                />
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Остаток, шт.">
                <Input inputMode="numeric" {...inp("stock_qty")} />
              </Field>
              <Field label="Сортировка">
                <Input inputMode="numeric" {...inp("sort_order")} />
              </Field>
            </div>
            {product?.source_url ? (
              <a href={product.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                <ExternalLink className="size-3" /> Источник на e8.ru
              </a>
            ) : null}
          </Panel>
        </div>
      </div>

      <div className="fixed right-4 bottom-4 z-30 sm:right-8 sm:bottom-6">
        <Button size="lg" className="h-12 px-6 shadow-xl shadow-primary/25" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} {isNew ? "Создать товар" : "Сохранить"}
        </Button>
      </div>
    </div>
  );
}
