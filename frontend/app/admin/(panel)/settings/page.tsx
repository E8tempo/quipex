"use client";

import { useState } from "react";
import { Loader2, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBox, Field, Loading, PageHeader, Panel, useApi } from "@/components/admin/ui";
import { useAdmin } from "@/components/admin/shell";
import { apiPut } from "@/lib/api-client";
import type { DeliveryMethod } from "@/lib/types";

type Settings = Record<string, unknown>;

function MethodsEditor({ value, onChange }: { value: DeliveryMethod[]; onChange: (v: DeliveryMethod[]) => void }) {
  return (
    <div className="space-y-2">
      {value.map((m, i) => (
        <div key={i} className="flex gap-2">
          <Input className="w-32" placeholder="код" value={m.id} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)))} />
          <Input placeholder="Название" value={m.title} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
          <Button variant="ghost" size="icon" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <X />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...value, { id: `m${value.length + 1}`, title: "" }])}>
        <Plus /> Добавить
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAdmin();
  const { data, error } = useApi<Settings>("/admin/settings");
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  if (data && !s) setS(data);

  if (error) return <ErrorBox message={error} />;
  if (!s) return <Loading />;

  const str = (k: string) => ({
    value: String(s[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setS({ ...s, [k]: e.target.value }),
  });
  const num = (k: string) => ({
    value: String(s[k] ?? 0),
    inputMode: "decimal" as const,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value.replace(",", ".").replace(/[^\d.-]/g, "")) || 0 }),
  });

  return (
    <div className="pb-24">
      <PageHeader title="Настройки сайта" description={user.is_superuser ? undefined : "Изменять настройки может только суперпользователь"} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Компания и контакты">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Название сайта">
              <Input {...str("site_name")} />
            </Field>
            <Field label="Слоган">
              <Input {...str("tagline")} />
            </Field>
            <Field label="Телефон">
              <Input {...str("phone")} placeholder="+7 (900) 000-00-00" />
            </Field>
            <Field label="Доп. телефон (опт)">
              <Input {...str("phone_secondary")} />
            </Field>
            <Field label="Email">
              <Input {...str("email")} />
            </Field>
            <Field label="Режим работы">
              <Input {...str("work_hours")} />
            </Field>
            <Field label="Адрес" className="sm:col-span-2">
              <Input {...str("address")} />
            </Field>
            <Field label="Юр. название">
              <Input {...str("legal_name")} placeholder='ООО «Квипекс»' />
            </Field>
            <Field label="ИНН">
              <Input {...str("inn")} />
            </Field>
            <Field label="Telegram (ссылка)">
              <Input {...str("telegram")} placeholder="https://t.me/..." />
            </Field>
            <Field label="WhatsApp (ссылка)">
              <Input {...str("whatsapp")} placeholder="https://wa.me/7..." />
            </Field>
            <Field label="ВКонтакте (ссылка)">
              <Input {...str("vk")} />
            </Field>
            <Field label="Карта (src iframe)" hint="Яндекс.Карты → Поделиться → Встроить карту">
              <Input {...str("map_embed_url")} />
            </Field>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Главная страница">
            <div className="grid gap-4">
              <Field label="Заголовок">
                <Input {...str("hero_title")} />
              </Field>
              <Field label="Подзаголовок">
                <Textarea rows={2} {...str("hero_subtitle")} />
              </Field>
              <Field label="Объявление над шапкой" hint="Пусто — не показывать">
                <Input {...str("announcement")} placeholder="Бесплатная доставка по городу от 50 000 ₽" />
              </Field>
            </div>
          </Panel>
          <Panel title="Опт и цены">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Опт от, шт. одной позиции" hint="0 — отключить">
                <Input {...num("wholesale_min_qty")} />
              </Field>
              <Field label="Опт от суммы заказа, ₽" hint="0 — отключить">
                <Input {...num("wholesale_min_order_sum")} />
              </Field>
              <Field label="Оптовая скидка по умолчанию, %">
                <Input {...num("wholesale_default_discount_percent")} />
              </Field>
              <Field label="Наценка при импорте, %" hint="Применяется к ценам e8.ru">
                <Input {...num("import_price_markup_percent")} />
              </Field>
              <label className="flex items-center justify-between gap-3 text-sm sm:col-span-2">
                <span>
                  <span className="font-medium">Рассчитывать оптовые цены при импорте</span>
                  <span className="block text-xs text-muted-foreground">Опт = розница − скидка по умолчанию</span>
                </span>
                <Switch checked={!!s.import_wholesale_from_retail} onCheckedChange={(v) => setS({ ...s, import_wholesale_from_retail: v })} />
              </label>
            </div>
          </Panel>
        </div>

        <Panel title="Способы доставки">
          <MethodsEditor value={(s.delivery_methods as DeliveryMethod[]) ?? []} onChange={(v) => setS({ ...s, delivery_methods: v })} />
        </Panel>
        <Panel title="Способы оплаты">
          <MethodsEditor value={(s.payment_methods as DeliveryMethod[]) ?? []} onChange={(v) => setS({ ...s, payment_methods: v })} />
        </Panel>
        <Panel title="SEO по умолчанию" className="xl:col-span-2">
          <div className="grid gap-4">
            <Field label="Title главной">
              <Input {...str("seo_title")} />
            </Field>
            <Field label="Description">
              <Textarea rows={2} {...str("seo_description")} />
            </Field>
          </div>
        </Panel>
      </div>
      {user.is_superuser ? (
        <div className="fixed right-4 bottom-4 z-30 sm:right-8 sm:bottom-6">
          <Button
            size="lg"
            className="h-12 px-6 shadow-xl shadow-primary/25"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                setS(await apiPut<Settings>("/admin/settings", s));
                toast.success("Настройки сохранены. На сайте обновятся в течение минуты.");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Ошибка");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Сохранить
          </Button>
        </div>
      ) : null}
    </div>
  );
}
