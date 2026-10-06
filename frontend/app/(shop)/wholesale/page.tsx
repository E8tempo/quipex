import type { Metadata } from "next";
import { BadgePercent, FileCheck2, Handshake, PackageCheck, Truck, UserRoundCheck } from "lucide-react";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { LeadForm } from "@/components/shop/lead-form";
import { apiGetOrNull } from "@/lib/api-server";
import { price } from "@/lib/format";
import { getSettings } from "@/lib/site";
import type { ContentPage } from "@/lib/types";

export const metadata: Metadata = {
  title: "Оптовым покупателям",
  description: "Оптовые поставки систем отопления: котлы, водонагреватели, бойлеры, комплектующие. Специальные цены для монтажных организаций и магазинов.",
};

export default async function WholesalePage() {
  const [s, page] = await Promise.all([getSettings(), apiGetOrNull<ContentPage>("/pages/wholesale")]);
  const perks = [
    {
      icon: BadgePercent,
      title: s.wholesale_default_discount_percent ? `Скидка до ${s.wholesale_default_discount_percent}%` : "Оптовые цены",
      text: [
        s.wholesale_min_qty ? `от ${s.wholesale_min_qty} шт. одной позиции` : null,
        s.wholesale_min_order_sum ? `или от ${price(s.wholesale_min_order_sum)} на весь заказ` : null,
      ]
        .filter(Boolean)
        .join(" ") || "Индивидуальные условия для партнёров",
    },
    { icon: UserRoundCheck, title: "Персональный менеджер", text: "Один контакт для всех вопросов: подбор, счета, отгрузки" },
    { icon: FileCheck2, title: "Полный пакет документов", text: "Договор, счёт-фактура, УПД, сертификаты и паспорта" },
    { icon: Truck, title: "Отгрузка по России", text: "Доставим до терминала ТК или прямо на объект" },
    { icon: PackageCheck, title: "Наличие на складе", text: "Ходовые позиции всегда в наличии, остальное — под заказ" },
    { icon: Handshake, title: "Отсрочка платежа", text: "Для постоянных партнёров по договору" },
  ];
  return (
    <div className="container-page space-y-10 pt-6">
      <Breadcrumbs items={[{ label: "Оптовым покупателям" }]} />
      <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold text-balance sm:text-4xl">Оптовым клиентам</h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Поставляем оборудование для отопления и горячего водоснабжения монтажным организациям, застройщикам, магазинам и
              сервисным центрам.
            </p>
          </div>
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {perks.map((p) => (
              <div key={p.title} className="py-2">
                <p.icon className="mb-3 size-5 text-foreground/60" strokeWidth={1.75} />
                <p className="font-medium">{p.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
              </div>
            ))}
          </div>
          {page ? <div className="prose-content max-w-3xl" dangerouslySetInnerHTML={{ __html: page.content }} /> : null}
        </div>
        <div className="h-fit rounded-3xl bg-muted/60 p-6 sm:p-8 lg:sticky lg:top-24">
          <h2 className="mb-1 text-2xl font-semibold">Запросить оптовый прайс</h2>
          <p className="mb-5 text-sm text-muted-foreground">Ответим в течение рабочего дня</p>
          <LeadForm type="wholesale" />
        </div>
      </div>
    </div>
  );
}
