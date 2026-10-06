"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import type { CategoryNode } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CatalogMenu({ categories }: { categories: CategoryNode[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(categories[0]?.id ?? null);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    // блокируем прокрутку страницы под открытым меню
    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [open]);

  // небольшая задержка при наведении — чтобы раздел не «прыгал», когда мышь идёт по диагонали к подкатегориям
  const hover = (id: number) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setActive(id), 90);
  };
  const cancelHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  const current = categories.find((c) => c.id === active) ?? categories[0];

  return (
    <div ref={ref} className="hidden md:block">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          "flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition",
          open ? "bg-foreground text-background" : "bg-muted hover:bg-secondary/70",
        )}
      >
        Каталог
        <ChevronDown className={cn("size-4 transition duration-200", open && "rotate-180")} />
      </button>

      {open ? (
        <>
          {/* затемнение страницы под меню; клик по нему закрывает меню */}
          <div
            className="fixed inset-x-0 top-16 bottom-0 z-30 bg-black/25 backdrop-blur-[2px] animate-in fade-in duration-200"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-x-0 top-full z-40 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="container-page pt-2">
              <div className="grid h-[min(34rem,calc(100dvh-6.5rem))] grid-cols-[16rem_1fr] lg:grid-cols-[20rem_1fr] overflow-hidden rounded-3xl border bg-background shadow-2xl shadow-black/10">
                <nav className="min-h-0 overflow-y-auto overscroll-contain border-r p-3" onMouseLeave={cancelHover}>
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/catalog/${c.slug}`}
                      onMouseEnter={() => hover(c.id)}
                      onFocus={() => setActive(c.id)}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm leading-snug transition",
                        current?.id === c.id ? "bg-muted font-medium text-foreground" : "text-foreground/75 hover:text-foreground",
                      )}
                    >
                      <span>{c.name}</span>
                      {c.children.length ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null}
                    </Link>
                  ))}
                </nav>

                {current ? (
                  <div key={current.id} className="flex min-h-0 gap-8 overflow-y-auto p-6 animate-in fade-in duration-150 lg:p-8">
                    <div className="min-w-0 flex-1">
                      <Link href={`/catalog/${current.slug}`} className="group inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        {current.name}
                        <ArrowRight className="size-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">{current.product_count} товаров</p>
                      {current.children.length ? (
                        <ul className="mt-6 grid gap-1 xl:grid-cols-2 xl:gap-x-6">
                          {current.children.map((ch) => (
                            <li key={ch.id}>
                              <Link
                                href={`/catalog/${ch.slug}`}
                                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[15px] transition hover:bg-muted"
                              >
                                {ch.name}
                                <span className="text-xs text-muted-foreground tabular-nums">{ch.product_count}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <Link
                        href={`/catalog/${current.slug}`}
                        className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-5 text-sm font-medium text-background transition hover:bg-foreground/85"
                      >
                        Смотреть все товары
                      </Link>
                    </div>
                    {current.cover ? (
                      <Link href={`/catalog/${current.slug}`} className="img-tile hidden aspect-square w-56 shrink-0 self-start overflow-hidden rounded-2xl p-6 xl:block">
                        <img src={current.cover} alt="" className="size-full object-contain" />
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
