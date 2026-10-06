import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { getSettings } from "@/lib/site";

export const metadata: Metadata = { title: "Оформление заказа", robots: { index: false } };

export default async function CheckoutPage() {
  const s = await getSettings();
  return (
    <div className="container-page space-y-6 pt-6">
      <Breadcrumbs items={[{ href: "/cart", label: "Корзина" }, { label: "Оформление заказа" }]} />
      <h1 className="text-3xl font-semibold">Оформление заказа</h1>
      <CheckoutForm
        deliveryMethods={s.delivery_methods}
        paymentMethods={s.payment_methods}
        wholesaleMinQty={s.wholesale_min_qty}
        wholesaleMinSum={s.wholesale_min_order_sum}
      />
    </div>
  );
}
