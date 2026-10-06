import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/common/theme-provider";
import { ServiceWorkerRegister } from "@/components/common/pwa";
import { SITE_URL, getSettings } from "@/lib/site";
import "./globals.css";

const onest = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-sans" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const title = s.seo_title || `${s.site_name} — ${s.tagline || "системы отопления"}`;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s — ${s.site_name}` },
    description: s.seo_description || s.hero_subtitle || undefined,
    openGraph: { siteName: s.site_name, locale: "ru_RU", type: "website" },
    applicationName: s.site_name,
    appleWebApp: { capable: true, title: s.site_name, statusBarStyle: "default" },
    icons: { apple: "/icons/apple-touch-icon.png" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfdfd" },
    { media: "(prefers-color-scheme: dark)", color: "#16171a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${onest.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-center" richColors closeButton />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
