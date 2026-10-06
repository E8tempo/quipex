"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Building2, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/shop/lead-form";
import { apiPost } from "@/lib/api-client";
import { useAccount } from "@/lib/stores/account";
import type { Customer } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const setCustomer = useAccount((s) => s.set);
  const [partner, setPartner] = useState(params.get("partner") === "1");
  const [f, setF] = useState({ email: "", password: "", name: "", phone: "", company: "", inn: "" });
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const next = params.get("next");
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  return (
    <form
      className="w-full max-w-md space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
          const c =
            mode === "login"
              ? await apiPost<Customer>("/account/auth/login", { email: f.email, password: f.password })
              : await apiPost<Customer>("/account/auth/register", {
                  ...f,
                  as_partner: partner,
                  company: partner ? f.company : null,
                  inn: partner ? f.inn : null,
                  website,
                });
          setCustomer(c);
          if (mode === "register" && partner) toast.success("Заявка на партнёрство отправлена — менеджер проверит данные");
          router.replace(target);
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Ошибка");
          setLoading(false);
        }
      }}
    >
      <div className="space-y-1.5 text-center">
        <h1 className="text-3xl font-semibold">{mode === "login" ? "Вход" : "Регистрация"}</h1>
        <p className="text-muted-foreground">
          {mode === "login" ? "Личный кабинет покупателя и партнёра" : "История заказов, быстрое оформление и партнёрские цены"}
        </p>
      </div>

      {mode === "register" ? (
        <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          {[
            { v: false, label: "Покупатель", icon: User },
            { v: true, label: "Партнёр (юр. лицо)", icon: Building2 },
          ].map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setPartner(t.v)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-full py-2 text-sm transition",
                partner === t.v ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
              )}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4">
        <input tabIndex={-1} autoComplete="off" className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden />
        {mode === "register" ? (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="r-name">Имя</Label>
              <Input id="r-name" required minLength={2} autoComplete="name" value={f.name} onChange={set("name")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="r-phone">Телефон</Label>
              <PhoneInput id="r-phone" required value={f.phone} onChange={(v) => setF((x) => ({ ...x, phone: v }))} />
            </div>
          </>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor="r-email">Email</Label>
          <Input id="r-email" type="email" required autoComplete={mode === "login" ? "username" : "email"} value={f.email} onChange={set("email")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="r-pass">Пароль</Label>
          <Input
            id="r-pass"
            type="password"
            required
            minLength={mode === "register" ? 8 : 1}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={f.password}
            onChange={set("password")}
          />
          {mode === "register" ? <p className="text-xs text-muted-foreground">Не менее 8 символов</p> : null}
        </div>
        {mode === "register" && partner ? (
          <div className="grid gap-4 rounded-2xl bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">
              После проверки менеджером вам откроются партнёрские цены и работа по договору.
            </p>
            <div className="grid gap-1.5">
              <Label htmlFor="r-company">Организация</Label>
              <Input id="r-company" required autoComplete="organization" value={f.company} onChange={set("company")} placeholder="ООО «Тепло»" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="r-inn">ИНН</Label>
              <Input id="r-inn" required inputMode="numeric" pattern="\d{10}|\d{12}" maxLength={12} value={f.inn} onChange={set("inn")} />
            </div>
          </div>
        ) : null}
      </div>

      <Button type="submit" size="lg" className="h-12 w-full text-[15px]" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : null}
        {mode === "login" ? "Войти" : partner ? "Отправить заявку" : "Зарегистрироваться"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            Нет аккаунта?{" "}
            <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-foreground underline-offset-4 hover:underline">
              Зарегистрироваться
            </Link>
          </>
        ) : (
          <>
            Уже есть аккаунт?{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Войти
            </Link>
            <br />
            <span className="mt-2 inline-block text-xs">
              Регистрируясь, вы соглашаетесь с{" "}
              <Link href="/info/privacy" className="underline">
                политикой конфиденциальности
              </Link>
            </span>
          </>
        )}
      </p>
    </form>
  );
}
