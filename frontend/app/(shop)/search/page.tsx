import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { Listing } from "@/components/shop/listing";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `Поиск: ${q}` : "Поиск", robots: { index: false } };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  return (
    <div className="container-page space-y-6 pt-6">
      <Breadcrumbs items={[{ label: "Поиск" }]} />
      <h1 className="text-3xl font-semibold">
        {q ? (
          <>
            Результаты по запросу <span className="text-brand">«{q}»</span>
          </>
        ) : (
          "Поиск по каталогу"
        )}
      </h1>
      <Listing sp={sp} basePath="/search" emptyText={q ? `По запросу «${q}» ничего не найдено` : "Введите запрос в строку поиска"} />
    </div>
  );
}
