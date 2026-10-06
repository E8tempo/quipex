import type { Metadata } from "next";

export const metadata: Metadata = { title: "Админ-панель", robots: { index: false, follow: false } };

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="flex min-h-screen flex-col bg-muted/30">{children}</div>;
}
