import Link from "next/link";
import { Logo } from "@/components/common/logo";
import { InstallAppButton } from "@/components/common/pwa";
import { phoneHref } from "@/lib/format";
import type { CategoryNode, SiteSettings } from "@/lib/types";

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-4 text-sm font-medium">{title}</p>
      <ul className="space-y-2.5 text-sm text-muted-foreground [&_a]:transition [&_a:hover]:text-foreground">{children}</ul>
    </div>
  );
}

export function Footer({ settings, categories }: { settings: SiteSettings; categories: CategoryNode[] }) {
  const year = new Date().getFullYear();
  const socials = [
    settings.telegram && { href: settings.telegram, label: "Telegram" },
    settings.whatsapp && { href: settings.whatsapp, label: "WhatsApp" },
    settings.vk && { href: settings.vk, label: "VK" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <footer className="mt-28 border-t">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo name={settings.site_name} />
          {settings.tagline ? <p className="max-w-xs text-sm text-muted-foreground">{settings.tagline}</p> : null}
          <InstallAppButton className="h-9" />
        </div>
        <Col title="Каталог">
          {categories.slice(0, 6).map((c) => (
            <li key={c.id}>
              <Link href={`/catalog/${c.slug}`}>{c.name}</Link>
            </li>
          ))}
        </Col>
        <Col title="Покупателям">
          <li><Link href="/wholesale">Оптовым клиентам</Link></li>
          <li><Link href="/sale">Скидки</Link></li>
          <li><Link href="/order-status">Статус заказа</Link></li>
          {settings.pages.filter((p) => p.slug !== "wholesale").map((p) => (
            <li key={p.slug}>
              <Link href={`/info/${p.slug}`}>{p.title}</Link>
            </li>
          ))}
        </Col>
        <Col title="Контакты">
          {settings.phone ? (
            <li>
              <a href={phoneHref(settings.phone)} className="text-base font-medium text-foreground">
                {settings.phone}
              </a>
            </li>
          ) : null}
          {settings.phone_secondary ? (
            <li>
              <a href={phoneHref(settings.phone_secondary)}>{settings.phone_secondary}</a>
            </li>
          ) : null}
          {settings.email ? (
            <li>
              <a href={`mailto:${settings.email}`}>{settings.email}</a>
            </li>
          ) : null}
          {settings.address ? <li>{settings.address}</li> : null}
          {settings.work_hours ? <li>{settings.work_hours}</li> : null}
          <li><Link href="/contacts">Все контакты</Link></li>
          {socials.length ? (
            <li className="flex gap-4 pt-1">
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              ))}
            </li>
          ) : null}
        </Col>
      </div>
      <div className="container-page flex flex-col gap-1 border-t py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <p>
          © {year} {settings.legal_name || settings.site_name}
          {settings.inn ? ` · ИНН ${settings.inn}` : ""}
        </p>
        <p>Информация на сайте не является публичной офертой</p>
      </div>
    </footer>
  );
}
