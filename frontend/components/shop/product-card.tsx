"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart3, Check, Heart, ImageOff, Plus, ShoppingBag, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { discountPercent, price } from "@/lib/format";
import { usePersonalPrice } from "@/lib/stores/account";
import { useCart, useCompare, useFavorites, useHydrated } from "@/lib/stores/shop";
import type { ProductCard as Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={cn("flex size-full items-center justify-center text-muted-foreground/40", className)}>
        <ImageOff className="size-10" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={cn("size-full object-contain", className)} />;
}

export function ToggleIconButton({
  active,
  onClick,
  label,
  activeLabel,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  activeLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClick();
            }}
            aria-label={active ? activeLabel : label}
            aria-pressed={active}
            className={cn(
              "flex size-10 items-center justify-center rounded-full border text-muted-foreground transition hover:bg-muted hover:text-foreground",
              active && "text-foreground",
              className,
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{active ? activeLabel : label}</TooltipContent>
    </Tooltip>
  );
}

export function FavCompareButtons({ product, className }: { product: Product; className?: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const fav = useFavorites((s) => s.ids.includes(product.id));
  const toggleFav = useFavorites((s) => s.toggle);
  const cmp = useCompare((s) => s.ids.includes(product.id));
  const toggleCmp = useCompare((s) => s.toggle);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ToggleIconButton
        active={hydrated && fav}
        label="В избранное"
        activeLabel="Убрать из избранного"
        onClick={() => {
          const added = toggleFav(product.id);
          toast(added ? "Добавлено в избранное" : "Удалено из избранного");
        }}
      >
        <Heart className={cn("size-4", hydrated && fav && "fill-sale text-sale")} />
      </ToggleIconButton>
      <ToggleIconButton
        active={hydrated && cmp}
        label="Сравнить"
        activeLabel="Убрать из сравнения"
        onClick={() => {
          const added = toggleCmp(product.id);
          toast(added ? "Добавлено к сравнению" : "Удалено из сравнения", {
            action: added ? { label: "Открыть", onClick: () => router.push("/compare") } : undefined,
          });
        }}
      >
        <BarChart3 className="size-4" />
      </ToggleIconButton>
    </div>
  );
}

export function AddToCartButton({
  product,
  qty = 1,
  size = "default",
  className,
  full,
}: {
  product: Product;
  qty?: number;
  size?: "default" | "lg" | "sm";
  className?: string;
  full?: boolean;
}) {
  const hydrated = useHydrated();
  const inCart = useCart((s) => s.items.find((i) => i.id === product.id)?.qty ?? 0);
  const add = useCart((s) => s.add);
  const setOpen = useCart((s) => s.setOpen);
  const [pulse, setPulse] = useState(false);

  const has = hydrated && inCart > 0;
  return (
    <Button
      size={size}
      variant={has ? "secondary" : "default"}
      className={cn(full && "w-full", pulse && "animate-in zoom-in-95", className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (has && qty === 1) {
          setOpen(true);
          return;
        }
        add(product, qty);
        setPulse(true);
        setTimeout(() => setPulse(false), 300);
        toast.success("Товар в корзине", {
          description: product.name,
          action: { label: "Оформить", onClick: () => setOpen(true) },
        });
      }}
    >
      {has ? <Check /> : <ShoppingBag />}
      {has ? `В корзине · ${inCart}` : product.in_stock ? "В корзину" : "Под заказ"}
    </Button>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`Рейтинг ${value} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn("size-3.5", i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")}
        />
      ))}
    </span>
  );
}

export function PriceBlock({ product, size = "md" }: { product: Product; size?: "md" | "lg" }) {
  const off = discountPercent(product.price, product.old_price);
  const personal = usePersonalPrice(product.id);
  if (personal) {
    return (
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={cn("font-semibold tracking-tight tabular-nums", size === "lg" ? "text-3xl" : "text-xl")}>
            {price(personal.price)}
          </span>
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">партнёрская цена</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Розница: <span className="line-through">{price(product.price)}</span>
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={cn("font-semibold tracking-tight tabular-nums", size === "lg" ? "text-3xl" : "text-xl", off && "text-sale")}>
        {price(product.price)}
      </span>
      {product.old_price && off ? (
        <>
          <span className={cn("text-muted-foreground line-through", size === "lg" ? "text-lg" : "text-sm")}>
            {price(product.old_price)}
          </span>
        </>
      ) : null}
    </div>
  );
}

function QuickAdd({ product }: { product: Product }) {
  const hydrated = useHydrated();
  const inCart = useCart((s) => s.items.some((i) => i.id === product.id));
  const add = useCart((s) => s.add);
  const setOpen = useCart((s) => s.setOpen);
  const has = hydrated && inCart;
  return (
    <button
      type="button"
      aria-label={has ? "Открыть корзину" : "В корзину"}
      title={has ? "В корзине" : product.in_stock ? "В корзину" : "Заказать"}
      onClick={(e) => {
        e.preventDefault();
        if (has) return setOpen(true);
        add(product);
        toast.success("Добавлено в корзину", {
          description: product.name,
          action: { label: "Корзина", onClick: () => setOpen(true) },
        });
      }}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full transition active:scale-95",
        has ? "bg-success/15 text-success" : "bg-foreground text-background hover:bg-foreground/85",
      )}
    >
      {has ? <Check className="size-[18px]" /> : <Plus className="size-[18px]" />}
    </button>
  );
}

function FavButton({ product, className }: { product: Product; className?: string }) {
  const hydrated = useHydrated();
  const fav = useFavorites((s) => s.ids.includes(product.id));
  const toggle = useFavorites((s) => s.toggle);
  const active = hydrated && fav;
  return (
    <button
      type="button"
      aria-label={active ? "Убрать из избранного" : "В избранное"}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        toggle(product.id);
      }}
      className={cn(
        "flex size-9 items-center justify-center rounded-full bg-white/80 text-zinc-500 backdrop-blur transition hover:text-zinc-900",
        active && "text-sale hover:text-sale",
        className,
      )}
    >
      <Heart className={cn("size-[18px]", active && "fill-current")} />
    </button>
  );
}

function CardPrice({ product, off }: { product: Product; off: number | null }) {
  const personal = usePersonalPrice(product.id);
  if (personal) {
    return (
      <div>
        <span className="text-[17px] font-semibold tabular-nums">{price(personal.price)}</span>
        <p className="text-xs text-muted-foreground">
          ваша цена · <span className="line-through">{price(product.price)}</span>
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={cn("text-[17px] font-semibold tabular-nums", off && "text-sale")}>{price(product.price)}</span>
      {off ? <span className="text-[13px] text-muted-foreground line-through tabular-nums">{price(product.old_price)}</span> : null}
    </div>
  );
}

export function ProductCard({ product, priority }: { product: Product; priority?: boolean }) {
  const off = discountPercent(product.price, product.old_price);
  const second = product.images[1];

  return (
    <div className="group/card relative flex flex-col">
      <Link href={`/product/${product.slug}`} className="img-tile relative block aspect-square overflow-hidden rounded-2xl">
        <img
          src={product.image ?? undefined}
          alt={product.name}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className={cn("absolute inset-0 size-full object-contain p-[12%] transition duration-500", second && "group-hover/card:opacity-0")}
        />
        {second ? (
          <img
            src={second}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-contain p-[12%] opacity-0 transition duration-500 group-hover/card:opacity-100"
          />
        ) : null}
        {off ? (
          <span className="absolute top-3 left-3 rounded-full bg-sale px-2 py-0.5 text-xs font-medium text-white">−{off}%</span>
        ) : null}
      </Link>
      <FavButton
        product={product}
        className="absolute top-2.5 right-2.5 sm:opacity-0 sm:group-hover/card:opacity-100 sm:focus-visible:opacity-100 aria-pressed:opacity-100"
      />
      <div className="flex flex-1 flex-col gap-3 px-1 pt-3">
        <Link href={`/product/${product.slug}`} className="line-clamp-2 text-[15px] leading-snug text-foreground/90 hover:text-foreground">
          {product.name}
        </Link>
        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0">
            <CardPrice product={product} off={off} />
            {!product.in_stock ? <p className="mt-0.5 text-xs text-muted-foreground">Под заказ</p> : null}
          </div>
          <QuickAdd product={product} />
        </div>
      </div>
    </div>
  );
}

export function ProductGrid({ products, className }: { products: Product[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 md:grid-cols-3 xl:grid-cols-4", className)}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}
