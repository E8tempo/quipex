"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { Loading } from "@/components/admin/ui";
import { useAccount } from "@/lib/stores/account";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/account", label: "Профиль" },
  { href: "/account/orders", label: "Заказы" },
];

export function AccountShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const customer = useAccount((s) => s.customer);
  const loaded = useAccount((s) => s.loaded);
  const logout = useAccount((s) => s.logout);

  useEffect(() => {
    if (loaded && !customer) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loaded, customer, router, pathname]);

  if (!loaded || !customer) return <Loading className="min-h-[50vh]" />;

  return (
    <div className="container-page space-y-8 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {customer.is_partner ? "Кабинет партнёра" : "Личный кабинет"}
          </p>
          <h1 className="text-3xl font-semibold">{customer.is_partner && customer.company ? customer.company : customer.name}</h1>
        </div>
        <button
          onClick={async () => {
            await logout();
            router.replace("/");
            router.refresh();
          }}
          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4" /> Выйти
        </button>
      </div>
      <nav className="flex gap-6 border-b">
        {TABS.map((t) => {
          const active = t.href === "/account" ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn("relative py-3 text-[15px] transition", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {t.label}
              {active ? <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-foreground" /> : null}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
