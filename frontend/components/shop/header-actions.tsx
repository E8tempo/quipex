"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, ChevronDown, Heart, Menu, Moon, Phone, Search, ShoppingBag, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "@/components/common/logo";
import { InstallAppButton } from "@/components/common/pwa";
import { SearchBox } from "@/components/shop/search-box";
import { phoneHref } from "@/lib/format";
import { useAccount } from "@/lib/stores/account";
import { useCart, useCompare, useFavorites, useHydrated } from "@/lib/stores/shop";
import type { CategoryNode } from "@/lib/types";
import { cn } from "@/lib/utils";

function Counter({ value }: { value: number }) {
  if (!value) return null;
  return (
    <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background tabular-nums">
      {value > 99 ? "99+" : value}
    </span>
  );
}

function IconLink({ href, label, children, onClick, className }: { href?: string; label: string; children: React.ReactNode; onClick?: () => void; className?: string }) {
  const cls = cn(
    "relative flex size-10 items-center justify-center rounded-full text-foreground/70 transition hover:bg-muted hover:text-foreground",
    className,
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls} aria-label={label} title={label}>
      {children}
    </button>
  ) : (
    <Link href={href!} className={cls} aria-label={label} title={label}>
      {children}
    </Link>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const dark = hydrated && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cn("flex size-10 items-center justify-center rounded-full text-foreground/70 transition hover:bg-muted hover:text-foreground", className)}
      aria-label={dark ? "Светлая тема" : "Тёмная тема"}
    >
      {dark ? <Sun className="size-[19px]" /> : <Moon className="size-[19px]" />}
    </button>
  );
}

function AccountLink() {
  const customer = useAccount((s) => s.customer);
  const loaded = useAccount((s) => s.loaded);
  const label = customer ? (customer.is_partner ? `Кабинет партнёра — ${customer.company ?? customer.name}` : "Личный кабинет") : "Войти";
  return (
    <IconLink href={customer ? "/account" : "/login"} label={label}>
      <UserRound className="size-5" />
      {loaded && customer?.is_partner ? (
        <span className="absolute right-1 bottom-1 size-2.5 rounded-full bg-brand ring-2 ring-background" />
      ) : null}
    </IconLink>
  );
}

export function HeaderActions() {
  const hydrated = useHydrated();
  const cartCount = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const setOpen = useCart((s) => s.setOpen);
  const fav = useFavorites((s) => s.ids.length);
  const cmp = useCompare((s) => s.ids.length);
  return (
    <div className="flex items-center">
      <ThemeToggle className="hidden sm:flex" />
      <IconLink href="/compare" label="Сравнение" className="hidden sm:flex">
        <BarChart3 className="size-5" />
        <Counter value={hydrated ? cmp : 0} />
      </IconLink>
      <IconLink href="/favorites" label="Избранное">
        <Heart className="size-5" />
        <Counter value={hydrated ? fav : 0} />
      </IconLink>
      <AccountLink />
      <IconLink label="Корзина" onClick={() => setOpen(true)}>
        <ShoppingBag className="size-5" />
        <Counter value={hydrated ? cartCount : 0} />
      </IconLink>
    </div>
  );
}

export function MobileSearchButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="flex size-10 items-center justify-center rounded-full text-foreground/70 hover:bg-muted md:hidden" onClick={() => setOpen(true)} aria-label="Поиск">
        <Search className="size-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="top" className="p-4 pt-12">
          <SheetTitle className="sr-only">Поиск</SheetTitle>
          <SearchBox autoFocus onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

export function MobileMenu({
  categories,
  siteName,
  phone,
  links,
}: {
  categories: CategoryNode[];
  siteName: string;
  phone?: string;
  links: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const pathname = usePathname();
  const [prev, setPrev] = useState(pathname);
  if (prev !== pathname) {
    setPrev(pathname);
    setOpen(false);
  }
  return (
    <>
      <button className="-ml-2 flex size-10 items-center justify-center rounded-full hover:bg-muted lg:hidden" onClick={() => setOpen(true)} aria-label="Меню">
        <Menu className="size-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[88vw] gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b p-4">
            <SheetTitle>
              <Logo name={siteName} />
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3">
            <p className="px-3 pt-1 pb-2 text-xs font-medium text-muted-foreground">Каталог</p>
            {categories.map((c) => (
              <div key={c.id}>
                <div className="flex items-center">
                  <Link href={`/catalog/${c.slug}`} className="flex-1 rounded-xl px-3 py-2.5 text-[15px] hover:bg-muted">
                    {c.name}
                  </Link>
                  {c.children.length ? (
                    <button
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                      onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                      aria-label="Подкатегории"
                    >
                      <ChevronDown className={cn("size-4 transition", expanded === c.id && "rotate-180")} />
                    </button>
                  ) : null}
                </div>
                {expanded === c.id ? (
                  <div className="mb-1 ml-3 border-l pl-3">
                    {c.children.map((ch) => (
                      <Link key={ch.id} href={`/catalog/${ch.slug}`} className="block rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                        {ch.name}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            <div className="my-3 border-t" />
            <Link href="/account" className="block rounded-xl px-3 py-2.5 text-[15px] font-medium hover:bg-muted">
              Личный кабинет
            </Link>
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="block rounded-xl px-3 py-2.5 text-[15px] hover:bg-muted">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="border-t px-4 pt-4">
            <InstallAppButton className="w-full" />
          </div>
          <div className="flex items-center justify-between p-4">
            {phone ? (
              <a href={phoneHref(phone)} className="flex items-center gap-2 text-sm font-medium">
                <Phone className="size-4 text-muted-foreground" /> {phone}
              </a>
            ) : (
              <span />
            )}
            <ThemeToggle />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
