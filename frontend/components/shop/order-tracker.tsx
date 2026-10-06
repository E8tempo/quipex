"use client";

import { useState } from "react";
import { Loader2, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/shop/lead-form";
import { api } from "@/lib/api-client";
import { ORDER_STATUS, dateTime, price } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Tracked {
  number: string;
  status: string;
  total: string;
  created_at: string;
}

const STEPS = ["new", "processing", "confirmed", "shipped", "completed"];

export function OrderTracker() {
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Tracked | null>(null);
  const step = order ? STEPS.indexOf(order.status) : -1;

  return (
    <div className="space-y-6">
      <form
        className="grid gap-4 rounded-2xl border p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setError("");
          try {
            setOrder(await api<Tracked>(`/orders/track?number=${encodeURIComponent(number)}&phone=${encodeURIComponent(phone)}`));
          } catch (err) {
            setOrder(null);
            setError(err instanceof Error ? err.message : "Ошибка");
          } finally {
            setLoading(false);
          }
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="ot-num">Номер заказа</Label>
          <Input id="ot-num" required placeholder="2610-00001" value={number} onChange={(e) => setNumber(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ot-phone">Телефон, указанный при заказе</Label>
          <PhoneInput id="ot-phone" required value={phone} onChange={setPhone} />
        </div>
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <PackageSearch />} Проверить
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>
      {order ? (
        <div className="space-y-5 rounded-2xl border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Заказ от {dateTime(order.created_at)}</p>
              <p className="font-mono text-lg font-semibold">№ {order.number}</p>
            </div>
            <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", ORDER_STATUS[order.status]?.tone)}>
              {ORDER_STATUS[order.status]?.label}
            </span>
          </div>
          {order.status !== "cancelled" ? (
            <ol className="grid grid-cols-5 gap-1.5">
              {STEPS.map((s, i) => (
                <li key={s} className="space-y-1.5">
                  <div className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
                  <p className={cn("text-[11px] leading-tight", i <= step ? "font-medium" : "text-muted-foreground")}>{ORDER_STATUS[s].label}</p>
                </li>
              ))}
            </ol>
          ) : null}
          <p className="flex justify-between border-t pt-4">
            <span className="text-muted-foreground">Сумма</span>
            <span className="font-semibold">{price(order.total)}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
