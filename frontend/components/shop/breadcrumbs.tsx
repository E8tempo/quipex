import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { SITE_URL } from "@/lib/site";

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  const all = [{ href: "/", label: "Главная" }, ...items];
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.label,
      ...(it.href ? { item: `${SITE_URL}${it.href}` } : {}),
    })),
  };
  return (
    <nav aria-label="Хлебные крошки" className="scrollbar-none -mx-1 overflow-x-auto px-1">
      <ol className="flex items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground">
        {all.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 ? <ChevronRight className="size-3.5 opacity-50" /> : null}
            {it.href && i < all.length - 1 ? (
              <Link href={it.href} className="transition hover:text-foreground">
                {i === 0 ? <Home className="size-4" aria-label="Главная" /> : it.label}
              </Link>
            ) : (
              <span className="max-w-[60vw] truncate text-foreground/80">{it.label}</span>
            )}
          </li>
        ))}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </nav>
  );
}
