import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getSettings } from "@/lib/site";
import { phoneHref } from "@/lib/format";

export const metadata: Metadata = { title: "Заказ оформлен", robots: { index: false } };

export default async function OrderDonePage({ params }: PageProps<"/order/[number]">) {
  const [{ number }, s] = await Promise.all([params, getSettings()]);
  return (
    <div className="container-page flex justify-center pt-16">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border p-8 text-center sm:p-12">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-success/15">
          <CheckCircle2 className="size-10 text-success" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Спасибо за заказ!</h1>
          <p className="text-muted-foreground">
            Номер заказа: <span className="font-mono text-lg font-semibold text-foreground">{decodeURIComponent(number)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Менеджер свяжется с вами в ближайшее время для подтверждения деталей доставки и оплаты.
          </p>
        </div>
        {s.phone ? (
          <p className="text-sm">
            Вопросы по заказу:{" "}
            <a href={phoneHref(s.phone)} className="font-semibold text-brand">
              {s.phone}
            </a>
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/catalog" className={buttonVariants({ size: "lg" })}>
            Продолжить покупки
          </Link>
          <Link href="/order-status" className={buttonVariants({ size: "lg", variant: "outline" })}>
            Статус заказа
          </Link>
        </div>
      </div>
    </div>
  );
}
