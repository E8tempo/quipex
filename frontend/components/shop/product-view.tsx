"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, FileText, Loader2, MessageSquareText, Truck, ShieldCheck, Warehouse, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QtyStepper } from "@/components/shop/cart";
import { LeadDialog } from "@/components/shop/lead-form";
import { AddToCartButton, FavCompareButtons, PriceBlock, ProductImage, Stars } from "@/components/shop/product-card";
import { api, apiPost } from "@/lib/api-client";
import { date, discountPercent, price } from "@/lib/format";
import { usePersonalPrice } from "@/lib/stores/account";
import { useRecent } from "@/lib/stores/shop";
import type { ProductDetail, Review } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Gallery({ product }: { product: ProductDetail }) {
  const images = product.gallery.length ? product.gallery.map((g) => g.url) : product.image ? [product.image] : [];
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const off = discountPercent(product.price, product.old_price);

  const goTo = (i: number) => {
    const n = (i + images.length) % images.length;
    setIdx(n);
    trackRef.current?.scrollTo({ left: n * trackRef.current.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="flex min-w-0 flex-col-reverse gap-3 md:flex-row">
      {images.length > 1 ? (
        <div className="scrollbar-none flex gap-2 overflow-x-auto md:max-h-[34rem] md:w-20 md:flex-col md:overflow-y-auto">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => goTo(i)}
              className={cn(
                "size-16 shrink-0 overflow-hidden rounded-xl img-tile border-2 p-1 transition md:size-20",
                i === idx ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
              aria-label={`Фото ${i + 1}`}
            >
              <img src={src} alt="" className="size-full object-contain" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
      <div className="group relative min-w-0 flex-1 overflow-hidden rounded-3xl img-tile">
        <div
          ref={trackRef}
          className="scrollbar-none flex aspect-square snap-x snap-mandatory overflow-x-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            const n = Math.round(el.scrollLeft / el.clientWidth);
            if (n !== idx) setIdx(n);
          }}
        >
          {images.length ? (
            images.map((src, i) => (
              <button key={src} className="size-full shrink-0 snap-center cursor-zoom-in p-6 sm:p-10" onClick={() => setZoom(true)}>
                <img src={src} alt={product.name} className="size-full object-contain" loading={i === 0 ? "eager" : "lazy"} />
              </button>
            ))
          ) : (
            <ProductImage src={null} alt="" />
          )}
        </div>
        {off ? <span className="absolute top-4 left-4 rounded-full bg-sale px-2.5 py-1 text-sm font-medium text-white">−{off}%</span> : null}
        {images.length > 1 ? (
          <>
            <button onClick={() => goTo(idx - 1)} className="absolute top-1/2 left-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-md transition hover:bg-white sm:group-hover:flex" aria-label="Назад">
              <ChevronLeft className="size-5" />
            </button>
            <button onClick={() => goTo(idx + 1)} className="absolute top-1/2 right-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-md transition hover:bg-white sm:group-hover:flex" aria-label="Вперёд">
              <ChevronRight className="size-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 md:hidden">
              {images.map((_, i) => (
                <span key={i} className={cn("h-1.5 rounded-full bg-zinc-300 transition-all", i === idx ? "w-5 bg-primary" : "w-1.5")} />
              ))}
            </div>
          </>
        ) : null}
        <span className="pointer-events-none absolute right-4 bottom-4 hidden rounded-full bg-white/90 p-2 text-zinc-700 opacity-0 shadow transition group-hover:opacity-100 sm:block">
          <Expand className="size-4" />
        </span>
      </div>

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent showCloseButton={false} className="max-w-[calc(100vw-2rem)] border-0 img-tile p-0 sm:max-w-5xl">
          <DialogTitle className="sr-only">{product.name}</DialogTitle>
          <div className="relative aspect-square max-h-[85vh] w-full sm:aspect-[4/3]">
            {images[idx] ? <img src={images[idx]} alt={product.name} className="size-full object-contain p-6" /> : null}
            <button onClick={() => setZoom(false)} className="absolute top-3 right-3 rounded-full bg-zinc-100 p-2 text-zinc-700 hover:bg-zinc-200" aria-label="Закрыть">
              <X className="size-5" />
            </button>
            {images.length > 1 ? (
              <>
                <button onClick={() => goTo(idx - 1)} className="absolute top-1/2 left-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-100 text-zinc-800 hover:bg-zinc-200" aria-label="Назад">
                  <ChevronLeft className="size-5" />
                </button>
                <button onClick={() => goTo(idx + 1)} className="absolute top-1/2 right-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-100 text-zinc-800 hover:bg-zinc-200" aria-label="Вперёд">
                  <ChevronRight className="size-5" />
                </button>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                  {idx + 1} / {images.length}
                </span>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function BuyBox({
  product,
  wholesaleMinQty,
  phone,
}: {
  product: ProductDetail;
  wholesaleMinQty: number;
  phone?: string;
}) {
  const [qty, setQty] = useState(1);
  const push = useRecent((s) => s.push);
  useEffect(() => push(product.id), [product.id, push]);
  const personal = usePersonalPrice(product.id);
  const hasWholesale = !personal && product.wholesale_price && Number(product.wholesale_price) < Number(product.price);
  const unit = personal ? personal.price : hasWholesale && wholesaleMinQty && qty >= wholesaleMinQty ? product.wholesale_price! : product.price;

  return (
    <div className="space-y-6">
      <div>
        <PriceBlock product={product} size="lg" />
        <p className={cn("mt-1 text-sm", product.in_stock ? "text-success" : "text-muted-foreground")}>
          {product.in_stock ? "В наличии" : "Под заказ — уточним сроки поставки"}
        </p>
        {hasWholesale ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Оптом{wholesaleMinQty ? ` от ${wholesaleMinQty} шт.` : ""} —{" "}
            <span className="font-medium text-foreground">{price(product.wholesale_price)}</span> за шт.
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <QtyStepper value={qty} onChange={(v) => setQty(Math.max(1, v))} size="lg" />
        <AddToCartButton product={product} qty={qty} size="lg" className="h-12 flex-1 rounded-full text-[15px]" />
      </div>
      {qty > 1 ? (
        <p className="-mt-3 text-sm text-muted-foreground">
          Итого {price(Number(unit) * qty)}
          {unit !== product.price && !personal ? <span className="ml-1 text-success">по оптовой цене</span> : null}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <LeadDialog
          type="preorder"
          productId={product.id}
          trigger={<Button variant="outline" className="h-10 rounded-full px-4">Купить в 1 клик</Button>}
        />
        <LeadDialog
          type="question"
          productId={product.id}
          trigger={<Button variant="ghost" className="h-10 rounded-full px-4 text-muted-foreground">Задать вопрос</Button>}
        />
        <FavCompareButtons product={product} className="ml-auto flex-row" />
      </div>

      <ul className="space-y-2 border-t pt-5 text-sm text-muted-foreground">
        <li className="flex items-center gap-2.5">
          <Truck className="size-4 shrink-0" strokeWidth={1.75} /> Доставка по России, самовывоз со склада
        </li>
        <li className="flex items-center gap-2.5">
          <ShieldCheck className="size-4 shrink-0" strokeWidth={1.75} /> Официальная гарантия производителя
        </li>
        {phone ? (
          <li className="flex items-center gap-2.5">
            <Warehouse className="size-4 shrink-0" strokeWidth={1.75} /> Опт и консультация: {phone}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

export function ProductTabs({ product }: { product: ProductDetail }) {
  const tabs = [
    product.description ? { id: "description", label: "Описание" } : null,
    product.specs.length ? { id: "specs", label: "Характеристики" } : null,
    product.documents.length ? { id: "docs", label: `Документы (${product.documents.length})` } : null,
    { id: "reviews", label: `Отзывы${product.reviews_count ? ` (${product.reviews_count})` : ""}` },
  ].filter(Boolean) as { id: string; label: string }[];
  const [tab, setTab] = useState(tabs[0].id);

  return (
    <div>
      <div className="scrollbar-none sticky top-16 z-10 -mx-4 flex gap-6 overflow-x-auto border-b bg-background/90 px-4 backdrop-blur sm:mx-0 sm:px-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative shrink-0 py-3.5 text-[15px] transition",
              tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {tab === t.id ? <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-foreground" /> : null}
          </button>
        ))}
      </div>
      <div className="pt-6">
        {tab === "description" && product.description ? (
          <div className="prose-content max-w-4xl" dangerouslySetInnerHTML={{ __html: product.description }} />
        ) : null}
        {tab === "specs" ? <Specs product={product} /> : null}
        {tab === "docs" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {product.documents.map((d) => (
              <a key={d.url} href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border p-4 transition hover:border-primary/40 hover:shadow-md">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <FileText className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm font-medium">{d.title}</span>
                  {d.size ? <span className="text-xs text-muted-foreground">PDF · {d.size}</span> : null}
                </span>
              </a>
            ))}
          </div>
        ) : null}
        {tab === "reviews" ? <Reviews product={product} /> : null}
      </div>
    </div>
  );
}

function Specs({ product }: { product: ProductDetail }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {product.specs.map((g, gi) => (
        <div key={gi}>
          {g.name ? <h3 className="mb-3 font-medium">{g.name}</h3> : null}
          <dl className="divide-y">
            {g.items.map((a, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 py-2.5 text-sm">
                <dt className="text-muted-foreground">{a.name}</dt>
                <dd>{a.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

function Reviews({ product }: { product: ProductDetail }) {
  const [items, setItems] = useState<Review[] | null>(null);
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    api<Review[]>(`/products/${product.id}/reviews`).then(setItems).catch(() => setItems([]));
  }, [product.id]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-4">
        {items === null ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        ) : items.length ? (
          items.map((r) => (
            <div key={r.id} className="rounded-2xl border p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{r.author}</span>
                <span className="text-xs text-muted-foreground">{date(r.created_at)}</span>
              </div>
              <Stars value={r.rating} />
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">{r.text}</p>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-3xl bg-muted/60 p-10 text-center text-muted-foreground">
            <MessageSquareText className="size-8 opacity-50" />
            Отзывов пока нет — станьте первым!
          </div>
        )}
      </div>
      <div className="h-fit rounded-2xl border p-5">
        {sent ? (
          <p className="text-sm">Спасибо! Отзыв появится после проверки модератором.</p>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setSending(true);
              try {
                await apiPost(`/products/${product.id}/reviews`, { author, text, rating });
                setSent(true);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Ошибка");
              } finally {
                setSending(false);
              }
            }}
          >
            <p className="text-lg font-semibold">Оставить отзыв</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button type="button" key={i} onClick={() => setRating(i)} className={cn("text-2xl leading-none", i <= rating ? "text-amber-400" : "text-muted-foreground/30")} aria-label={`${i} из 5`}>
                  ★
                </button>
              ))}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rv-author">Имя</Label>
              <Input id="rv-author" required minLength={2} value={author} onChange={(e) => setAuthor(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rv-text">Отзыв</Label>
              <Textarea id="rv-text" required minLength={5} rows={4} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <Button type="submit" disabled={sending}>
              {sending ? <Loader2 className="animate-spin" /> : null} Отправить
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
