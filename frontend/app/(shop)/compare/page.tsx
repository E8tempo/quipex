import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { CompareView } from "@/components/shop/saved-views";

export const metadata: Metadata = { title: "Сравнение товаров", robots: { index: false } };

export default function ComparePage() {
  return (
    <div className="container-page space-y-6 pt-6">
      <Breadcrumbs items={[{ label: "Сравнение" }]} />
      <h1 className="text-3xl font-semibold">Сравнение товаров</h1>
      <CompareView />
    </div>
  );
}
