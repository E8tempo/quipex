import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { apiGetOrNull } from "@/lib/api-server";
import type { ContentPage } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/info/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await apiGetOrNull<ContentPage>(`/pages/${slug}`);
  return page ? { title: page.title, description: page.meta_description ?? undefined } : {};
}

export default async function InfoPage({ params }: PageProps<"/info/[slug]">) {
  const { slug } = await params;
  const page = await apiGetOrNull<ContentPage>(`/pages/${slug}`);
  if (!page) notFound();
  return (
    <div className="container-page space-y-6 pt-6">
      <Breadcrumbs items={[{ label: page.title }]} />
      <article className="max-w-3xl space-y-6">
        <h1 className="text-3xl font-semibold">{page.title}</h1>
        <div className="prose-content" dangerouslySetInnerHTML={{ __html: page.content }} />
      </article>
    </div>
  );
}
