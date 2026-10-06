import type { Money } from "./types";

const rub = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export function price(v: Money | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return `${rub.format(Number(v))} ₽`;
}

export function num(v: Money | null | undefined): number {
  return v === null || v === undefined || v === "" ? 0 : Number(v);
}

export function discountPercent(p: Money, old: Money | null): number | null {
  if (!old) return null;
  const a = Number(p);
  const b = Number(old);
  if (!b || b <= a) return null;
  return Math.round((1 - a / b) * 100);
}

/** plural(5, ["товар", "товара", "товаров"]) */
export function plural(n: number, forms: [string, string, string]): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function date(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  new: { label: "Новый", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  processing: { label: "В обработке", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  confirmed: { label: "Подтверждён", tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  shipped: { label: "Отгружен", tone: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
  completed: { label: "Выполнен", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  cancelled: { label: "Отменён", tone: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400" },
};

export const LEAD_TYPE: Record<string, string> = {
  callback: "Обратный звонок",
  wholesale: "Опт",
  question: "Вопрос",
  preorder: "Предзаказ",
};

export const LEAD_STATUS: Record<string, { label: string; tone: string }> = {
  new: { label: "Новая", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  in_progress: { label: "В работе", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  done: { label: "Обработана", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  rejected: { label: "Отклонена", tone: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400" },
};
