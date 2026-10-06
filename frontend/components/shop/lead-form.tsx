"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiPost } from "@/lib/api-client";
import type { LeadType } from "@/lib/types";

export function formatPhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d[0] === "8") d = "7" + d.slice(1);
  if (d[0] !== "7") d = "7" + d;
  d = d.slice(0, 11);
  const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
  let out = "+7";
  if (p[0]) out += ` (${p[0]}`;
  if (p[0].length === 3) out += ")";
  if (p[1]) out += ` ${p[1]}`;
  if (p[2]) out += `-${p[2]}`;
  if (p[3]) out += `-${p[3]}`;
  return out;
}

export function PhoneInput(props: Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> & {
  value: string;
  onChange: (v: string) => void;
}) {
  const { value, onChange, ...rest } = props;
  return (
    <Input
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="+7 (___) ___-__-__"
      value={value}
      onChange={(e) => onChange(formatPhoneInput(e.target.value))}
      {...rest}
    />
  );
}

const COPY: Record<LeadType, { title: string; desc: string; button: string; message?: string }> = {
  callback: {
    title: "Заказать звонок",
    desc: "Оставьте номер — перезвоним в рабочее время и ответим на все вопросы.",
    button: "Жду звонка",
  },
  wholesale: {
    title: "Оптовое сотрудничество",
    desc: "Расскажите о компании и объёмах — подготовим индивидуальное предложение.",
    button: "Получить предложение",
    message: "Объёмы, интересующие позиции, регион",
  },
  question: {
    title: "Задать вопрос",
    desc: "Специалист ответит и поможет подобрать оборудование.",
    button: "Отправить",
    message: "Ваш вопрос",
  },
  preorder: {
    title: "Предзаказ",
    desc: "Сообщим о поступлении и зарезервируем товар для вас.",
    button: "Оформить предзаказ",
    message: "Количество, пожелания",
  },
};

export function LeadForm({
  type,
  productId,
  onDone,
  withCompany,
  className,
}: {
  type: LeadType;
  productId?: number;
  onDone?: () => void;
  withCompany?: boolean;
  className?: string;
}) {
  const copy = COPY[type];
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const showCompany = withCompany ?? type === "wholesale";

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="size-12 text-success" />
        <p className="text-lg font-semibold">Заявка отправлена</p>
        <p className="text-sm text-muted-foreground">Менеджер свяжется с вами в ближайшее время.</p>
      </div>
    );
  }

  return (
    <form
      className={className ?? "grid gap-4"}
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
          await apiPost("/leads", {
            type,
            name,
            phone,
            email: email || null,
            company: company || null,
            message: message || null,
            product_id: productId ?? null,
            page_url: window.location.href,
            website,
          });
          setSent(true);
          onDone?.();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Не удалось отправить");
        } finally {
          setLoading(false);
        }
      }}
    >
      <input
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        aria-hidden
      />
      <div className="grid gap-1.5">
        <Label htmlFor={`lead-name-${type}`}>Имя</Label>
        <Input id={`lead-name-${type}`} required minLength={2} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`lead-phone-${type}`}>Телефон</Label>
        <PhoneInput id={`lead-phone-${type}`} required value={phone} onChange={setPhone} />
      </div>
      {showCompany ? (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor={`lead-company-${type}`}>Компания</Label>
            <Input id={`lead-company-${type}`} value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`lead-email-${type}`}>Email</Label>
            <Input id={`lead-email-${type}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
        </>
      ) : null}
      {copy.message ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`lead-msg-${type}`}>Сообщение</Label>
          <Textarea id={`lead-msg-${type}`} placeholder={copy.message} value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
        </div>
      ) : null}
      <Button type="submit" size="lg" disabled={loading} className="h-11">
        {loading ? <Loader2 className="animate-spin" /> : null}
        {copy.button}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Нажимая кнопку, вы соглашаетесь с{" "}
        <Link href="/info/privacy" className="underline underline-offset-2">
          политикой конфиденциальности
        </Link>
      </p>
    </form>
  );
}

export function LeadDialog({
  type,
  productId,
  trigger,
}: {
  type: LeadType;
  productId?: number;
  trigger: React.ReactElement;
}) {
  const copy = COPY[type];
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{copy.title}</DialogTitle>
          <DialogDescription>{copy.desc}</DialogDescription>
        </DialogHeader>
        <LeadForm type={type} productId={productId} key={String(open)} />
      </DialogContent>
    </Dialog>
  );
}
