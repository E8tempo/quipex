import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { ReloadButton } from "@/components/common/pwa";

export const metadata: Metadata = { title: "Нет соединения", robots: { index: false } };

export default function OfflinePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted">
        <WifiOff className="size-6 text-muted-foreground" />
      </span>
      <h1 className="text-2xl font-semibold">Нет подключения к интернету</h1>
      <p className="max-w-sm text-muted-foreground">
        Проверьте соединение и попробуйте ещё раз. Ранее открытые страницы доступны и без сети.
      </p>
      <ReloadButton />
    </div>
  );
}
