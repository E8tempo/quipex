"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { price } from "@/lib/format";
import type { ProductCard } from "@/lib/types";
import { cn } from "@/lib/utils";

function Tile({ p }: { p: ProductCard }) {
  return (
    <Link
      href={`/product/${p.slug}`}
      className="group img-tile relative block aspect-[3/4] overflow-hidden rounded-[1.5rem]"
      aria-label={`${p.name}, ${price(p.price)}`}
    >
      {p.image ? (
        <img
          src={p.image}
          alt=""
          decoding="async"
          className="absolute inset-0 size-full object-contain p-[12%] transition duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:scale-[1.05]"
        />
      ) : null}
      <span className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-white text-zinc-900 opacity-0 shadow-sm transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
        <ArrowUpRight className="size-4" />
      </span>
      <span className="absolute inset-x-3 bottom-3 translate-y-3 rounded-2xl bg-white/90 px-3.5 py-2.5 text-zinc-900 opacity-0 backdrop-blur transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 [@media(hover:none)]:right-auto [@media(hover:none)]:translate-y-0 [@media(hover:none)]:px-3 [@media(hover:none)]:py-1.5 [@media(hover:none)]:opacity-100">
        {/* на тачскринах наведения нет — там видна только компактная цена */}
        <span className="line-clamp-1 text-xs sm:text-sm [@media(hover:none)]:hidden">{p.name}</span>
        <span className="text-sm font-semibold tabular-nums">{price(p.price)}</span>
      </span>
    </Link>
  );
}

/**
 * Две колонки крупных карточек товаров в высокой рамке. Левая прижата к верху и при
 * прокрутке страницы уезжает вверх, правая прижата к низу и уезжает вниз (параллакс).
 * Исходное положение задано вёрсткой, поэтому до запуска скрипта ничего не прыгает.
 */
export function HeroGallery({ products }: { products: ProductCard[] }) {
  const frame = useRef<HTMLDivElement>(null);
  const cols = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = frame.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      // 0 — страница наверху, 1 — рамка ушла за верх экрана
      const p = Math.min(1, Math.max(0, window.scrollY / (box.top + window.scrollY + box.height)));
      cols.current.forEach((col, i) => {
        if (!col) return;
        const range = Math.max(0, col.scrollHeight - box.height);
        const y = (i === 0 ? -1 : 1) * p * range;
        col.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const list = products.filter((p) => p.image).slice(0, 6);
  if (list.length < 2) return null;
  const columns = [list.filter((_, i) => i % 2 === 0), list.filter((_, i) => i % 2 === 1)];

  return (
    <div ref={frame} className="relative h-[28rem] overflow-hidden rounded-[2rem] sm:h-[34rem] lg:h-[38rem]">
      {columns.map((col, i) => (
        <div
          key={i}
          ref={(el) => {
            cols.current[i] = el;
          }}
          className={cn(
            "absolute flex w-[calc(50%-0.375rem)] flex-col gap-3 will-change-transform sm:w-[calc(50%-0.5rem)] sm:gap-4",
            i === 0 ? "top-0 left-0" : "right-0 bottom-0",
          )}
        >
          {col.map((p) => (
            <Tile key={p.id} p={p} />
          ))}
        </div>
      ))}
    </div>
  );
}
