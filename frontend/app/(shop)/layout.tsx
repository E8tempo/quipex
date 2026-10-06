import { Header } from "@/components/shop/header";
import { Footer } from "@/components/shop/footer";
import { CartQuoteSync, CartSheet } from "@/components/shop/cart";
import { AccountSync } from "@/lib/stores/account";
import { getCategoryTree, getSettings } from "@/lib/site";

export default async function ShopLayout({ children }: LayoutProps<"/">) {
  const [settings, categories] = await Promise.all([getSettings(), getCategoryTree()]);
  return (
    <>
      <Header settings={settings} categories={categories} />
      <main className="flex-1">{children}</main>
      <Footer settings={settings} categories={categories} />
      <CartSheet wholesaleMinQty={settings.wholesale_min_qty} wholesaleMinSum={settings.wholesale_min_order_sum} />
      <CartQuoteSync />
      <AccountSync />
    </>
  );
}
