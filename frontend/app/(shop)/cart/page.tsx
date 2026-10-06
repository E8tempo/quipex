import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { CartPageView } from "@/components/shop/cart-page";
import { getSettings } from "@/lib/site";

export const metadata: Metadata = { title: "Корзина", robots: { index: false } };

export default async function CartPage() {
  const s = await getSettings();
  return (
    <div className="container-page space-y-6 pt-6">
      <Breadcrumbs items={[{ label: "Корзина" }]} />
      <CartPageView wholesaleMinQty={s.wholesale_min_qty} wholesaleMinSum={s.wholesale_min_order_sum} />
    </div>
  );
}
