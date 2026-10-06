import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, PackageSearch } from "lucide-react";
import { ActiveFilterChips, CatalogFilters, MobileFilters, SortSelect } from "@/components/shop/catalog-filters";
import { ProductGrid } from "@/components/shop/product-card";
import { apiGet, buildQuery } from "@/lib/api-server";
import { plural } from "@/lib/format";
import type { ProductList } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SearchParams = Record<string, string | string[] | undefined>;

const PASS = ["sort", "price_min", "price_max", "in_stock", "page", "q"] as const;

export function listingQuery(sp: SearchParams, extra: Record<string, string | boolean | undefined> = {}) {
  const q: Record<string, string | string[] | boolean | undefined> = { ...extra };
  for (const k of PASS) {
    const v = sp[k];
    if (typeof v === "string" && v) q[k] = v;
  }
  const f = sp.f;
  q.f = Array.isArray(f) ? f : f ? [f] : [];
  q.per_page = "24";
  return q;
}

function Pagination({ page, pages, sp, basePath }: { page: number; pages: number; sp: SearchParams; basePath: string }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const params: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(sp)) if (v !== undefined && k !== "page") params[k] = v;
    if (p > 1) params.page = String(p);
    return `${basePath}${buildQuery(params)}`;
  };
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  const cls = "flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm transition";
  return (
    <nav className="mt-10 flex flex-wrap items-center justify-center gap-1.5" aria-label="Страницы">
      {page > 1 ? (
        <Link href={href(page - 1)} className={cn(cls, "hover:bg-muted")} aria-label="Назад">
          <ChevronLeft className="size-4" />
        </Link>
      ) : null}
      {nums.map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <Link key={n} href={href(n)} className={cn(cls, n === page ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
            {n}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link href={href(page + 1)} className={cn(cls, "hover:bg-muted")} aria-label="Вперёд">
          <ChevronRight className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}

export async function Listing({
  sp,
  basePath,
  extra,
  emptyText = "По заданным параметрам ничего не найдено",
}: {
  sp: SearchParams;
  basePath: string;
  extra?: Record<string, string | boolean | undefined>;
  emptyText?: string;
}) {
  const data = await apiGet<ProductList>("/products", listingQuery(sp, extra));
  const filterProps = { facets: data.facets, priceMin: data.price_min, priceMax: data.price_max };

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_1fr] xl:gap-12">
      <Suspense>
        <CatalogFilters {...filterProps} />
      </Suspense>
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Suspense>
              <MobileFilters {...filterProps} total={data.total} />
            </Suspense>
            <p className="text-sm text-muted-foreground">
              {data.total} {plural(data.total, ["товар", "товара", "товаров"])}
            </p>
          </div>
          <Suspense>
            <SortSelect />
          </Suspense>
        </div>
        <Suspense>
          <ActiveFilterChips />
        </Suspense>
        {data.items.length ? (
          <ProductGrid products={data.items} className="xl:grid-cols-3 2xl:grid-cols-4" />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-muted/60 py-20 text-center">
            <PackageSearch className="size-10 text-muted-foreground/50" strokeWidth={1.5} />
            <p className="font-medium">{emptyText}</p>
            <p className="text-sm text-muted-foreground">Попробуйте изменить фильтры или поисковый запрос</p>
          </div>
        )}
        <Pagination page={data.page} pages={data.pages} sp={sp} basePath={basePath} />
      </div>
    </div>
  );
}
