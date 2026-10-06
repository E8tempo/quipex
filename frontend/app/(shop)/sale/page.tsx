import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { Listing } from "@/components/shop/listing";

export const metadata: Metadata = { title: "Акции и скидки", alternates: { canonical: "/sale" } };

export default async function SalePage({ searchParams }: PageProps<"/sale">) {
  const sp = await searchParams;
  return (
    <div className="container-page space-y-6 pt-6">
      <Breadcrumbs items={[{ label: "Акции" }]} />
      <div>
        <h1 className="text-3xl font-semibold">Акции и скидки</h1>
        <p className="mt-2 text-muted-foreground">Товары со сниженной ценой. Количество ограничено.</p>
      </div>
      <Listing sp={sp} basePath="/sale" extra={{ sale: true }} emptyText="Сейчас нет активных акций" />
    </div>
  );
}
