"use client";

import { useState } from "react";
import { BadgeCheck, Clock, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/shop/lead-form";
import { apiPatch, apiPost } from "@/lib/api-client";
import { useAccount } from "@/lib/stores/account";
import type { Customer } from "@/lib/types";

function Section({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-b pb-10 last:border-0 lg:grid-cols-[18rem_1fr]">
      <div>
        <h2 className="font-medium">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="max-w-xl">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PartnerBlock({ customer }: { customer: Customer }) {
  const set = useAccount((s) => s.set);
  const [form, setForm] = useState({ company: customer.company ?? "", inn: customer.inn ?? "", kpp: customer.kpp ?? "", legal_address: customer.legal_address ?? "", message: "" });
  const [sending, setSending] = useState(false);

  if (customer.is_partner) {
    return (
      <div className="space-y-4 rounded-2xl bg-muted/60 p-5">
        <p className="flex items-center gap-2 font-medium">
          <BadgeCheck className="size-5 text-success" /> Партнёрский доступ активен
        </p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Организация</dt>
            <dd>{customer.company}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">ИНН{customer.kpp ? " / КПП" : ""}</dt>
            <dd>
              {customer.inn}
              {customer.kpp ? ` / ${customer.kpp}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Тип цен</dt>
            <dd>{customer.price_type_name ?? (customer.discount_percent ? `Скидка ${Number(customer.discount_percent)}%` : "Оптовые цены")}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">Цены на сайте показаны с учётом ваших условий. Реквизиты меняет менеджер.</p>
      </div>
    );
  }
  if (customer.partner_status === "pending") {
    return (
      <div className="flex gap-3 rounded-2xl bg-muted/60 p-5 text-sm">
        <Clock className="size-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">Заявка на рассмотрении</p>
          <p className="mt-1 text-muted-foreground">
            {customer.company}, ИНН {customer.inn}. Менеджер проверит данные и откроет партнёрские цены — обычно в течение рабочего дня.
          </p>
        </div>
      </div>
    );
  }
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSending(true);
        try {
          set(await apiPost<Customer>("/account/partner-request", { ...form, kpp: form.kpp || null, legal_address: form.legal_address || null, message: form.message || null }));
          toast.success("Заявка отправлена");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Ошибка");
        } finally {
          setSending(false);
        }
      }}
    >
      {customer.partner_status === "rejected" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <XCircle className="size-4" /> Предыдущая заявка отклонена. Можно уточнить данные и отправить снова.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Организация">
          <Input required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        </Field>
        <Field label="ИНН">
          <Input required inputMode="numeric" pattern="\d{10}|\d{12}" maxLength={12} value={form.inn} onChange={(e) => setForm({ ...form, inn: e.target.value })} />
        </Field>
        <Field label="КПП">
          <Input inputMode="numeric" maxLength={9} value={form.kpp} onChange={(e) => setForm({ ...form, kpp: e.target.value })} />
        </Field>
        <Field label="Юридический адрес">
          <Input value={form.legal_address} onChange={(e) => setForm({ ...form, legal_address: e.target.value })} />
        </Field>
      </div>
      <Field label="Комментарий">
        <Textarea rows={2} placeholder="Профиль компании, объёмы закупок" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      </Field>
      <Button type="submit" className="h-10 w-fit px-5" disabled={sending}>
        {sending ? <Loader2 className="animate-spin" /> : null} Стать партнёром
      </Button>
    </form>
  );
}

export function ProfileView() {
  const customer = useAccount((s) => s.customer)!;
  const set = useAccount((s) => s.set);
  const [p, setP] = useState({ name: customer.name, phone: customer.phone ?? "", city: customer.city ?? "", address: customer.address ?? "" });
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [pwSaving, setPwSaving] = useState(false);

  return (
    <div className="space-y-10">
      <Section
        title="Партнёрство"
        description={customer.is_partner ? undefined : "Монтажным организациям, застройщикам и магазинам — специальные цены и работа по договору."}
      >
        <PartnerBlock customer={customer} />
      </Section>

      <Section title="Контактные данные" description="Подставляются при оформлении заказа">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              set(await apiPatch<Customer>("/account/me", p));
              toast.success("Сохранено");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Ошибка");
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Имя">
              <Input required minLength={2} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
            </Field>
            <Field label="Телефон">
              <PhoneInput value={p.phone} onChange={(v) => setP({ ...p, phone: v })} />
            </Field>
            <Field label="Email">
              <Input value={customer.email} disabled />
            </Field>
            <Field label="Город">
              <Input value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} />
            </Field>
          </div>
          <Field label="Адрес доставки">
            <Input value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} />
          </Field>
          <Button type="submit" variant="secondary" className="h-10 w-fit px-5" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : null} Сохранить
          </Button>
        </form>
      </Section>

      <Section title="Пароль" description="После смены пароля другие устройства выйдут из аккаунта">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setPwSaving(true);
            try {
              await apiPost("/account/password", pw);
              setPw({ current_password: "", new_password: "" });
              toast.success("Пароль изменён");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Ошибка");
            } finally {
              setPwSaving(false);
            }
          }}
        >
          <Field label="Текущий пароль">
            <Input type="password" required autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
          </Field>
          <Field label="Новый пароль">
            <Input type="password" required minLength={8} autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
          </Field>
          <Button type="submit" variant="secondary" className="h-10 w-fit px-5" disabled={pwSaving}>
            {pwSaving ? <Loader2 className="animate-spin" /> : null} Сменить пароль
          </Button>
        </form>
      </Section>
    </div>
  );
}
