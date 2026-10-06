import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { Listing } from "@/components/shop/listing";
import { apiGetOrNull } from "@/lib/api-server";
import type { CategoryDetail } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/catalog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const cat = await apiGetOrNull<CategoryDetail>(`/categories/${slug}`);
  if (!cat) return {};
  return {
    title: cat.meta_title || cat.name,
    description: cat.meta_description || `${cat.name} — купить оптом и в розницу. ${cat.product_count} товаров в наличии и под заказ.`,
    alternates: { canonical: `/catalog/${cat.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/catalog/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const cat = await apiGetOrNull<CategoryDetail>(`/categories/${slug}`);
  if (!cat) notFound();

  return (
    <div className="container-page space-y-6 pt-6">
      <Breadcrumbs
        items={[
          { href: "/catalog", label: "Каталог" },
          ...cat.breadcrumbs.slice(0, -1).map((b) => ({ href: `/catalog/${b.slug}`, label: b.name })),
          { label: cat.name },
        ]}
      />
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">{cat.name}</h1>
        {cat.children.length ? (
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {cat.children.map((ch) => (
              <Link
                key={ch.id}
                href={`/catalog/${ch.slug}`}
                className="shrink-0 rounded-full bg-muted px-4 py-2 text-sm transition hover:bg-secondary"
              >
                {ch.name} <span className="ml-1 text-muted-foreground">{ch.product_count}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <Listing sp={sp} basePath={`/catalog/${cat.slug}`} extra={{ category: cat.slug }} />
      {cat.description ? (
        <div className="prose-content max-w-4xl pt-8" dangerouslySetInnerHTML={{ __html: cat.description }} />
      ) : null}
    </div>
  );
}
