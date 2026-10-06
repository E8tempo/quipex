import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { BuyBox, Gallery, ProductTabs } from "@/components/shop/product-view";
import { RecentlyViewed } from "@/components/shop/recently-viewed";
import { ProductRail, SectionHeader } from "@/components/shop/sections";
import { apiGet, apiGetOrNull } from "@/lib/api-server";
import { SITE_URL, getSettings } from "@/lib/site";
import type { ProductCard, ProductDetail } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await apiGetOrNull<ProductDetail>(`/products/${slug}`);
  if (!p) return {};
  const description =
    p.meta_description ||
    `${p.name} — купить по цене ${Math.round(Number(p.price))} ₽. Доставка по России, опт и розница.`;
  return {
    title: p.meta_title || p.name,
    description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { title: p.name, description, images: p.image ? [{ url: p.image }] : undefined },
  };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const product = await apiGetOrNull<ProductDetail>(`/products/${slug}`);
  if (!product) notFound();
  const [settings, related] = await Promise.all([
    getSettings(),
    apiGet<ProductCard[]>(`/products/${slug}/related`).catch(() => []),
  ]);

  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku ?? undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    image: product.gallery.map((g) => (g.url.startsWith("http") ? g.url : `${SITE_URL}${g.url}`)),
    description: product.meta_description ?? undefined,
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/product/${product.slug}`,
      priceCurrency: "RUB",
      price: Number(product.price),
      availability: product.in_stock ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
    },
    ...(product.rating
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviews_count } }
      : {}),
  };

  return (
    <div className="space-y-16">
      <div className="container-page space-y-6 pt-6">
        <Breadcrumbs
          items={[
            { href: "/catalog", label: "Каталог" },
            ...product.breadcrumbs.map((b) => ({ href: `/catalog/${b.slug}`, label: b.name })),
            { label: product.name },
          ]}
        />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:gap-16">
          <Gallery product={product} />
          <div className="min-w-0 space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                {product.sku ? <span>Арт. {product.sku}</span> : null}
                {product.brand ? <span>{product.brand}</span> : null}
                {product.rating ? (
                  <span className="flex items-center gap-1">
                    <Star className="size-4 fill-amber-400 text-amber-400" /> {product.rating} · {product.reviews_count} отзывов
                  </span>
                ) : null}
              </div>
              <h1 className="text-2xl leading-tight font-semibold text-balance sm:text-[32px]">{product.name}</h1>
            </div>
            {product.highlights.length ? (
              <dl className="flex flex-wrap gap-x-8 gap-y-3 border-y py-4">
                {product.highlights.map((h) => (
                  <div key={h.name}>
                    <dt className="text-xs text-muted-foreground">{h.name}</dt>
                    <dd className="mt-0.5 font-medium">{h.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <BuyBox product={product} wholesaleMinQty={settings.wholesale_min_qty} phone={settings.phone} />
          </div>
        </div>
        <div className="pt-6">
          <ProductTabs product={product} />
        </div>
      </div>

      {related.length ? (
        <section className="container-page">
          <SectionHeader
            title="Похожие товары"
            href={product.category ? `/catalog/${product.category.slug}` : undefined}
            linkLabel="Весь раздел"
          />
          <ProductRail products={related} />
        </section>
      ) : null}
      <RecentlyViewed excludeId={product.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </div>
  );
}
