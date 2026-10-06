"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CartLines, CartSummary } from "@/components/shop/cart";
import { PhoneInput } from "@/components/shop/lead-form";
import { apiPost } from "@/lib/api-client";
import { useAccount } from "@/lib/stores/account";
import { useCart, useHydrated } from "@/lib/stores/shop";
import type { DeliveryMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function OptionCards({
  options,
  value,
  onChange,
  name,
}: {
  options: DeliveryMethod[];
  value: string;
  onChange: (v: string) => void;
  name: string;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <label
          key={o.id}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm transition",
            value === o.id ? "border-primary bg-primary/5 ring-2 ring-primary/15" : "hover:border-foreground/20",
          )}
        >
          <input type="radio" name={name} className="mt-0.5 accent-[var(--primary)]" checked={value === o.id} onChange={() => onChange(o.id)} />
          <span className="font-medium">{o.title}</span>
        </label>
      ))}
    </div>
  );
}

export function CheckoutForm({
  deliveryMethods,
  paymentMethods,
  wholesaleMinQty,
  wholesaleMinSum,
}: {
  deliveryMethods: DeliveryMethod[];
  paymentMethods: DeliveryMethod[];
  wholesaleMinQty: number;
  wholesaleMinSum: number;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const [type, setType] = useState<"retail" | "wholesale">("retail");
  const [form, setForm] = useState({ name: "", phone: "", email: "", company: "", inn: "", city: "", address: "", comment: "" });
  const [delivery, setDelivery] = useState(deliveryMethods[0]?.id ?? "");
  const [payment, setPayment] = useState(paymentMethods[0]?.id ?? "");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const customer = useAccount((s) => s.customer);
  const [prefilled, setPrefilled] = useState<number | null>(null);
  if (customer && prefilled !== customer.id) {
    setPrefilled(customer.id);
    setForm((f) => ({
      ...f,
      name: f.name || customer.name,
      phone: f.phone || customer.phone || "",
      email: f.email || customer.email,
      company: f.company || customer.company || "",
      inn: f.inn || customer.inn || "",
      city: f.city || customer.city || "",
      address: f.address || customer.address || "",
    }));
    if (customer.is_partner) setType("wholesale");
  }
  const partner = !!customer?.is_partner;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (!hydrated) return <div className="h-96 animate-pulse rounded-3xl bg-muted" />;
  if (!items.length) {
    return (
      <div className="rounded-3xl bg-muted/60 p-12 text-center">
        <p className="mb-4 text-muted-foreground">В корзине нет товаров</p>
        <Link href="/catalog" className={buttonVariants()}>
          Перейти в каталог
        </Link>
      </div>
    );
  }

  const deliveryTitle = deliveryMethods.find((d) => d.id === delivery)?.title;
  const paymentTitle = paymentMethods.find((d) => d.id === payment)?.title;
  const needsAddress = delivery !== "pickup";

  return (
    <form
      className="grid items-start gap-6 lg:grid-cols-[1fr_26rem]"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
          const order = await apiPost<{ number: string }>("/orders", {
            items: items.map((i) => ({ product_id: i.id, quantity: i.qty })),
            customer_type: type,
            ...form,
            email: form.email || null,
            company: type === "wholesale" ? form.company : null,
            inn: type === "wholesale" ? form.inn || null : null,
            delivery_method: deliveryTitle ?? null,
            payment_method: paymentTitle ?? null,
            website,
          });
          clear();
          router.push(`/order/${encodeURIComponent(order.number)}`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Не удалось оформить заказ");
          setLoading(false);
        }
      }}
    >
      <div className="space-y-6">
        <section className="space-y-5 rounded-2xl border p-5 sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold">1. Покупатель</h2>
            {!customer ? (
              <Link href="/login?next=/checkout" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Войти — данные подставятся сами
              </Link>
            ) : null}
          </div>
          {partner ? (
            <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">
              Заказ оформляется на {customer?.company} по партнёрским ценам.
            </p>
          ) : null}
          <div className={cn("grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1", partner && "hidden")}>
            {[
              { id: "retail" as const, label: "Физ. лицо", icon: User },
              { id: "wholesale" as const, label: "Юр. лицо / ИП", icon: Building2 },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition",
                  type === t.id ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
              >
                <t.icon className="size-4" /> {t.label}
              </button>
            ))}
          </div>
          <input tabIndex={-1} autoComplete="off" className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Имя и фамилия *">
              <Input required minLength={2} value={form.name} onChange={set("name")} autoComplete="name" />
            </Field>
            <Field label="Телефон *">
              <PhoneInput required value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
            </Field>
            <Field label="Email" className="sm:col-span-2">
              <Input type="email" value={form.email} onChange={set("email")} autoComplete="email" placeholder="для отправки счёта и чека" />
            </Field>
            {type === "wholesale" ? (
              <>
                <Field label="Организация *">
                  <Input required value={form.company} onChange={set("company")} autoComplete="organization" disabled={partner} />
                </Field>
                <Field label="ИНН">
                  <Input value={form.inn} onChange={set("inn")} inputMode="numeric" maxLength={12} disabled={partner} />
                </Field>
              </>
            ) : null}
          </div>
        </section>

        {deliveryMethods.length ? (
          <section className="space-y-5 rounded-2xl border p-5 sm:p-7">
            <h2 className="text-xl font-semibold">2. Доставка</h2>
            <OptionCards options={deliveryMethods} value={delivery} onChange={setDelivery} name="delivery" />
            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <Field label="Город">
                <Input value={form.city} onChange={set("city")} autoComplete="address-level2" />
              </Field>
              {needsAddress ? (
                <Field label="Адрес доставки">
                  <Input value={form.address} onChange={set("address")} autoComplete="street-address" />
                </Field>
              ) : null}
            </div>
          </section>
        ) : null}

        {paymentMethods.length ? (
          <section className="space-y-5 rounded-2xl border p-5 sm:p-7">
            <h2 className="text-xl font-semibold">3. Оплата</h2>
            <OptionCards options={paymentMethods} value={payment} onChange={setPayment} name="payment" />
            <Field label="Комментарий к заказу">
              <Textarea rows={3} value={form.comment} onChange={set("comment")} placeholder="Удобное время звонка, этаж, пожелания…" />
            </Field>
          </section>
        ) : null}
      </div>

      <aside className="space-y-4 rounded-2xl border p-5 sm:p-6 lg:sticky lg:top-28">
        <h2 className="text-xl font-semibold">Ваш заказ</h2>
        <div className="max-h-80 overflow-y-auto">
          <CartLines compact />
        </div>
        <div className="border-t pt-4">
          <CartSummary wholesaleMinQty={wholesaleMinQty} wholesaleMinSum={wholesaleMinSum} />
        </div>
        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          Подтвердить заказ
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Оплата после подтверждения заказа менеджером. Нажимая кнопку, вы соглашаетесь с{" "}
          <Link href="/info/privacy" className="underline">
            политикой конфиденциальности
          </Link>
          .
        </p>
      </aside>
    </form>
  );
}
