import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/common/logo";
import { CatalogMenu } from "@/components/shop/catalog-menu";
import { HeaderActions, MobileMenu, MobileSearchButton } from "@/components/shop/header-actions";
import { SearchBox } from "@/components/shop/search-box";
import { phoneHref } from "@/lib/format";
import type { CategoryNode, SiteSettings } from "@/lib/types";

export const NAV_LINKS = [
  { href: "/catalog", label: "Каталог" },
  { href: "/sale", label: "Акции" },
  { href: "/wholesale", label: "Оптовикам" },
  { href: "/info/delivery", label: "Доставка" },
  { href: "/contacts", label: "Контакты" },
];

export function Header({ settings, categories }: { settings: SiteSettings; categories: CategoryNode[] }) {
  return (
    <>
      {settings.announcement ? (
        <div className="bg-foreground px-4 py-2 text-center text-xs text-background sm:text-[13px]">{settings.announcement}</div>
      ) : null}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background">
        <div className="relative">
          <div className="container-page flex h-16 items-center gap-2 sm:gap-4">
            <MobileMenu categories={categories} siteName={settings.site_name} phone={settings.phone} links={NAV_LINKS.slice(1)} />
            <Link href="/" className="mr-2 shrink-0" aria-label="На главную">
              <Logo name={settings.site_name} />
            </Link>
            <CatalogMenu categories={categories} />
            <nav className="hidden items-center gap-1 text-sm xl:flex">
              {NAV_LINKS.slice(1, 4).map((l) => (
                <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-muted-foreground transition hover:text-foreground">
                  {l.label}
                </Link>
              ))}
            </nav>
            <Suspense fallback={<div className="hidden h-10 flex-1 md:block" />}>
              <SearchBox className="ml-auto hidden max-w-md flex-1 md:block" />
            </Suspense>
            <div className="ml-auto flex items-center md:ml-0">
              {settings.phone ? (
                <a
                  href={phoneHref(settings.phone)}
                  className="mr-2 hidden text-sm font-medium whitespace-nowrap transition hover:text-brand 2xl:block"
                >
                  {settings.phone}
                </a>
              ) : null}
              <Suspense>
                <MobileSearchButton />
              </Suspense>
              <HeaderActions />
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
