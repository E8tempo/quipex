import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { LeadForm } from "@/components/shop/lead-form";
import { phoneHref } from "@/lib/format";
import { getSettings } from "@/lib/site";

export const metadata: Metadata = { title: "Контакты" };

export default async function ContactsPage() {
  const s = await getSettings();
  const rows = [
    s.phone && { icon: Phone, label: "Телефон", value: s.phone, href: phoneHref(s.phone) },
    s.phone_secondary && { icon: Phone, label: "Отдел оптовых продаж", value: s.phone_secondary, href: phoneHref(s.phone_secondary) },
    s.email && { icon: Mail, label: "Email", value: s.email, href: `mailto:${s.email}` },
    s.address && { icon: MapPin, label: "Адрес", value: s.address },
    s.work_hours && { icon: Clock, label: "Режим работы", value: s.work_hours },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string }[];

  return (
    <div className="container-page space-y-8 pt-6">
      <Breadcrumbs items={[{ label: "Контакты" }]} />
      <h1 className="text-3xl font-semibold">Контакты</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_26rem]">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {rows.map((r) => (
              <div key={r.label} className="flex gap-4 py-2">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/70">
                  <r.icon className="size-[18px]" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm text-muted-foreground">{r.label}</p>
                  {r.href ? (
                    <a href={r.href} className="font-medium hover:text-brand">
                      {r.value}
                    </a>
                  ) : (
                    <p className="font-medium">{r.value}</p>
                  )}
                </div>
              </div>
            ))}
            {!rows.length ? <p className="text-muted-foreground">Контакты можно заполнить в админ-панели → Настройки.</p> : null}
          </div>
          {s.legal_name || s.inn ? (
            <div className="rounded-2xl border p-5 text-sm">
              <p className="mb-2 font-semibold">Реквизиты</p>
              {s.legal_name ? <p>{s.legal_name}</p> : null}
              {s.inn ? <p className="text-muted-foreground">ИНН {s.inn}</p> : null}
            </div>
          ) : null}
          {s.map_embed_url ? (
            <iframe src={s.map_embed_url} className="h-96 w-full rounded-3xl" loading="lazy" title="Карта" />
          ) : null}
        </div>
        <div className="h-fit rounded-3xl bg-muted/60 p-6 sm:p-8">
          <h2 className="mb-5 text-2xl font-semibold">Напишите нам</h2>
          <LeadForm type="question" />
        </div>
      </div>
    </div>
  );
}
