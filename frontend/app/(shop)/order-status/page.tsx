import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { OrderTracker } from "@/components/shop/order-tracker";

export const metadata: Metadata = { title: "Статус заказа", robots: { index: false } };

export default function OrderStatusPage() {
  return (
    <div className="container-page space-y-6 pt-6">
      <Breadcrumbs items={[{ label: "Статус заказа" }]} />
      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="text-3xl font-semibold">Статус заказа</h1>
        <OrderTracker />
      </div>
    </div>
  );
}
