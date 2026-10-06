import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { FavoritesView } from "@/components/shop/saved-views";

export const metadata: Metadata = { title: "Избранное", robots: { index: false } };

export default function FavoritesPage() {
  return (
    <div className="container-page space-y-6 pt-6">
      <Breadcrumbs items={[{ label: "Избранное" }]} />
      <h1 className="text-3xl font-semibold">Избранное</h1>
      <FavoritesView />
    </div>
  );
}
