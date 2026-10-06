"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import {
  ExternalLink,
  FileText,
  FolderTree,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Package,
  RefreshCw,
  Settings,
  ShoppingBag,
  Users,
  Contact,
  Tags,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LogoMark } from "@/components/common/logo";
import { Loading } from "@/components/admin/ui";
import { ThemeToggle } from "@/components/shop/header-actions";
import { ApiError, api, apiPost } from "@/lib/api-client";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Counters {
  orders: number;
  leads: number;
  reviews: number;
  partners: number;
  import_running: boolean;
}

const AdminCtx = createContext<{ user: User; refreshCounters: () => void } | null>(null);
export function useAdmin() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error("useAdmin outside AdminShell");
  return ctx;
}

const NAV = [
  { href: "/admin", label: "Дашборд", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Заказы", icon: ShoppingBag, counter: "orders" as const },
  { href: "/admin/leads", label: "Заявки", icon: Inbox, counter: "leads" as const },
  { href: "/admin/customers", label: "Клиенты", icon: Contact, counter: "partners" as const },
  { href: "/admin/products", label: "Товары", icon: Package },
  { href: "/admin/price-types", label: "Типы цен", icon: Tags },
  { href: "/admin/categories", label: "Категории", icon: FolderTree },
  { href: "/admin/reviews", label: "Отзывы", icon: MessageSquareText, counter: "reviews" as const },
  { href: "/admin/import", label: "Импорт с e8.ru", icon: RefreshCw },
  { href: "/admin/pages", label: "Страницы", icon: FileText },
  { href: "/admin/settings", label: "Настройки", icon: Settings },
  { href: "/admin/users", label: "Пользователи", icon: Users, superuser: true },
];

function Nav({ counters, user, onNavigate }: { counters: Counters | null; user: User; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5">
      {NAV.filter((n) => !n.superuser || user.is_superuser).map((n) => {
        const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
        const count = n.counter && counters ? counters[n.counter] : 0;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <n.icon className={cn("size-4.5", n.href === "/admin/import" && counters?.import_running && "animate-spin")} />
            <span className="flex-1">{n.label}</span>
            {count ? (
              <span className={cn("rounded-full px-2 text-xs font-bold", active ? "bg-white/25" : "bg-primary text-primary-foreground")}>{count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [counters, setCounters] = useState<Counters | null>(null);
  const [mobile, setMobile] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    api<User>("/auth/me")
      .then(setUser)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = () => api<Counters>("/admin/counters").then(setCounters).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [user, tick, pathname]);

  if (!user) return <Loading className="flex-1" />;

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/admin" className="flex items-center gap-2.5 px-2">
        <LogoMark className="size-8" />
        <span className="font-heading text-lg font-extrabold">Админ-панель</span>
      </Link>
      <div className="flex-1 overflow-y-auto">
        <Nav counters={counters} user={user} onNavigate={() => setMobile(false)} />
      </div>
      <div className="space-y-1 border-t pt-4">
        <a href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
          <ExternalLink className="size-4.5" /> Открыть сайт
        </a>
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.full_name || "Администратор"}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <ThemeToggle />
          <button
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
            aria-label="Выйти"
            onClick={async () => {
              await apiPost("/auth/logout").catch(() => {});
              router.replace("/admin/login");
            }}
          >
            <LogOut className="size-4.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <AdminCtx.Provider value={{ user, refreshCounters: () => setTick((t) => t + 1) }}>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-sidebar lg:block">{sidebar}</aside>
        <Sheet open={mobile} onOpenChange={setMobile}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Меню</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:hidden">
            <button onClick={() => setMobile(true)} aria-label="Меню">
              <Menu className="size-6" />
            </button>
            <span className="font-heading font-bold">Админ-панель</span>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </AdminCtx.Provider>
  );
}
