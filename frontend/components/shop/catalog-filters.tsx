"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, Loader2, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { Facet, Money } from "@/lib/types";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "popular", label: "По популярности" },
  { value: "price_asc", label: "Сначала дешевле" },
  { value: "price_desc", label: "Сначала дороже" },
  { value: "new", label: "Новинки" },
  { value: "name", label: "По названию" },
];

function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const update = (mutate: (sp: URLSearchParams) => void) => {
    const sp = new URLSearchParams(params.toString());
    mutate(sp);
    sp.delete("page");
    const qs = sp.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { params, update, pending };
}

export function SortSelect() {
  const { params, update, pending } = useQueryUpdater();
  const value = params.get("sort") ?? "popular";
  return (
    <label className="flex items-center gap-2 text-sm">
      {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      <span className="hidden text-muted-foreground sm:inline">Сортировка:</span>
      <span className="relative">
        <select
          value={value}
          onChange={(e) => update((sp) => (e.target.value === "popular" ? sp.delete("sort") : sp.set("sort", e.target.value)))}
          className="h-9 appearance-none rounded-full bg-muted pr-8 pl-4 text-sm outline-none focus:ring-2 focus:ring-ring/30"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      </span>
    </label>
  );
}

function FacetGroup({ facet, selected, onToggle, defaultOpen }: { facet: Facet; selected: string[]; onToggle: (v: string) => void; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen || selected.length > 0);
  const [all, setAll] = useState(false);
  const values = all ? facet.values : facet.values.slice(0, 5);
  return (
    <div className="border-t py-4">
      <button className="flex w-full items-center justify-between text-left text-sm font-medium" onClick={() => setOpen(!open)}>
        {facet.name}
        <ChevronDown className={cn("size-4 text-muted-foreground transition", !open && "-rotate-90")} />
      </button>
      {open ? (
        <div className="mt-3 space-y-2.5">
          {values.map((v) => {
            const checked = selected.includes(v.value);
            return (
              <label key={v.value} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={checked} onCheckedChange={() => onToggle(v.value)} />
                <span className={cn("flex-1 text-foreground/80", checked && "text-foreground")}>{v.value}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{v.count}</span>
              </label>
            );
          })}
          {facet.values.length > 5 ? (
            <button className="text-xs font-medium text-brand" onClick={() => setAll(!all)}>
              {all ? "Свернуть" : `Показать все (${facet.values.length})`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FiltersBody({ facets, priceMin, priceMax }: { facets: Facet[]; priceMin: Money | null; priceMax: Money | null }) {
  const { params, update, pending } = useQueryUpdater();
  const selected = params.getAll("f");
  const [pmin, setPmin] = useState(params.get("price_min") ?? "");
  const [pmax, setPmax] = useState(params.get("price_max") ?? "");
  const inStock = params.get("in_stock") === "true";

  const toggleFacet = (name: string, value: string) => {
    const token = `${name}:${value}`;
    update((sp) => {
      const cur = sp.getAll("f");
      sp.delete("f");
      (cur.includes(token) ? cur.filter((x) => x !== token) : [...cur, token]).forEach((x) => sp.append("f", x));
    });
  };
  const applyPrice = () =>
    update((sp) => {
      if (pmin) sp.set("price_min", pmin.replace(/\D/g, ""));
      else sp.delete("price_min");
      if (pmax) sp.set("price_max", pmax.replace(/\D/g, ""));
      else sp.delete("price_max");
    });
  const hasAny = selected.length || params.get("price_min") || params.get("price_max") || inStock;

  return (
    <div className={cn("transition-opacity", pending && "opacity-60")}>
      <div className="pb-4">
        <p className="mb-3 text-sm font-medium">Цена, ₽</p>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyPrice();
          }}
        >
          <Input inputMode="numeric" placeholder={priceMin ? `от ${Math.floor(Number(priceMin))}` : "от"} value={pmin} onChange={(e) => setPmin(e.target.value)} onBlur={applyPrice} />
          <span className="text-muted-foreground">—</span>
          <Input inputMode="numeric" placeholder={priceMax ? `до ${Math.ceil(Number(priceMax))}` : "до"} value={pmax} onChange={(e) => setPmax(e.target.value)} onBlur={applyPrice} />
        </form>
      </div>
      <label className="flex cursor-pointer items-center justify-between border-t py-4 text-sm font-medium">
        Только в наличии
        <Switch checked={inStock} onCheckedChange={(v) => update((sp) => (v ? sp.set("in_stock", "true") : sp.delete("in_stock")))} />
      </label>
      {facets.map((f, i) => (
        <FacetGroup
          key={f.name}
          defaultOpen={i < 3}
          facet={f}
          selected={selected.filter((s) => s.startsWith(`${f.name}:`)).map((s) => s.slice(f.name.length + 1))}
          onToggle={(v) => toggleFacet(f.name, v)}
        />
      ))}
      {hasAny ? (
        <Button
          variant="outline"
          className="mt-2 w-full"
          onClick={() => {
            setPmin("");
            setPmax("");
            update((sp) => {
              ["f", "price_min", "price_max", "in_stock"].forEach((k) => sp.delete(k));
            });
          }}
        >
          <X /> Сбросить фильтры
        </Button>
      ) : null}
    </div>
  );
}

export function CatalogFilters(props: { facets: Facet[]; priceMin: Money | null; priceMax: Money | null }) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
        <FiltersBody {...props} />
      </div>
    </aside>
  );
}

export function MobileFilters(props: { facets: Facet[]; priceMin: Money | null; priceMax: Money | null; total: number }) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const active = params.getAll("f").length + (params.get("in_stock") ? 1 : 0) + (params.get("price_min") || params.get("price_max") ? 1 : 0);
  return (
    <>
      <Button variant="secondary" className="h-9 rounded-full px-4 lg:hidden" onClick={() => setOpen(true)}>
        <SlidersHorizontal /> Фильтры
        {active ? <span className="ml-1 rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background text-primary-foreground">{active}</span> : null}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[88vw] gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b p-4">
            <SheetTitle>Фильтры</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <FiltersBody facets={props.facets} priceMin={props.priceMin} priceMax={props.priceMax} />
          </div>
          <div className="border-t p-4">
            <Button className="h-11 w-full rounded-full" size="lg" onClick={() => setOpen(false)}>
              Показать {props.total} товаров
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function ActiveFilterChips() {
  const { params, update } = useQueryUpdater();
  const chips = params.getAll("f");
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <button
          key={c}
          onClick={() =>
            update((sp) => {
              const rest = sp.getAll("f").filter((x) => x !== c);
              sp.delete("f");
              rest.forEach((x) => sp.append("f", x));
            })
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs hover:bg-secondary"
        >
          {c.replace(":", ": ")}
          <X className="size-3" />
        </button>
      ))}
    </div>
  );
}
