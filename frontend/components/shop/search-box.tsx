"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, FolderOpen, Loader2, Search, X } from "lucide-react";
import { ProductImage } from "@/components/shop/product-card";
import { api } from "@/lib/api-client";
import { price } from "@/lib/format";
import type { CategoryBrief, ProductCard } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Suggest {
  products: ProductCard[];
  categories: CategoryBrief[];
}

export function SearchBox({ className, autoFocus, onNavigate }: { className?: string; autoFocus?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [data, setData] = useState<Suggest | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      api<Suggest>(`/search/suggest?q=${encodeURIComponent(term)}`)
        .then((d) => !cancelled && (setData(d), setCursor(-1)))
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    inputRef.current?.blur();
    onNavigate?.();
    router.push(href);
  };

  const items = data && q.trim().length >= 2 ? data.products : [];
  const cats = data && q.trim().length >= 2 ? data.categories : [];
  const showPanel = open && q.trim().length >= 2;

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (cursor >= 0 && items[cursor]) return go(`/product/${items[cursor].slug}`);
          if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, -1));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Поиск товаров"
          className="h-10 w-full rounded-full border border-transparent bg-muted pr-16 pl-10 text-sm outline-none transition placeholder:text-muted-foreground focus:border-border focus:bg-background focus:ring-4 focus:ring-brand/10"
          aria-label="Поиск по каталогу"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="search-suggest"
        />
        <div className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1.5">
          {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          {q ? (
            <button type="button" onClick={() => (setQ(""), inputRef.current?.focus())} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Очистить">
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="hidden rounded-md px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground lg:block">Ctrl K</kbd>
          )}
        </div>
      </form>

      {showPanel ? (
        <div
          id="search-suggest"
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 min-w-80 overflow-hidden rounded-2xl border bg-popover shadow-xl animate-in fade-in slide-in-from-top-1 duration-100"
        >
          {cats.length ? (
            <div className="flex flex-wrap gap-2 border-b p-3">
              {cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => go(`/catalog/${c.slug}`)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs hover:bg-secondary"
                >
                  <FolderOpen className="size-3.5" /> {c.name}
                </button>
              ))}
            </div>
          ) : null}
          {items.length ? (
            <ul className="max-h-[60vh] overflow-y-auto p-1.5">
              {items.map((p, i) => (
                <li key={p.id}>
                  <Link
                    href={`/product/${p.slug}`}
                    onClick={() => (setOpen(false), onNavigate?.())}
                    onMouseEnter={() => setCursor(i)}
                    className={cn("flex items-center gap-3 rounded-xl p-2", cursor === i && "bg-muted")}
                  >
                    <span className="img-tile size-12 shrink-0 overflow-hidden rounded-lg p-1">
                      <ProductImage src={p.image} alt="" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.sku ? `Арт. ${p.sku}` : p.category?.name}</span>
                    </span>
                    <span className="shrink-0 text-sm font-medium tabular-nums">{price(p.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : !loading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Ничего не нашлось. Попробуйте изменить запрос.</p>
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">Ищем…</p>
          )}
          {items.length ? (
            <button
              onClick={() => go(`/search?q=${encodeURIComponent(q.trim())}`)}
              className="flex w-full items-center justify-center gap-1 border-t p-3 text-sm font-medium text-brand hover:bg-muted"
            >
              Все результаты <ArrowRight className="size-4" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
