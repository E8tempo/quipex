"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, RotateCw, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Событие установки может прийти до монтирования React — держим его в модуле.
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

type InstallMode = "prompt" | "ios" | null;

function getMode(): InstallMode {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return null;
  if (deferred) return "prompt";
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  return isIOS ? "ios" : null;
}

/** Можно ли предложить установку: Android/Chrome — системный диалог, iOS — инструкция. */
export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, getMode, () => null);
}

export function InstallAppButton({ className, variant = "outline" }: { className?: string; variant?: "outline" | "ghost" }) {
  const mode = useInstallMode();
  const [iosHelp, setIosHelp] = useState(false);
  if (!mode) return null;
  return (
    <>
      <Button
        variant={variant}
        className={cn("gap-2", className)}
        onClick={async () => {
          if (mode === "ios") return setIosHelp(true);
          if (!deferred) return;
          await deferred.prompt();
          await deferred.userChoice;
          deferred = null;
          emit();
        }}
      >
        <Download className="size-4" /> Установить приложение
      </Button>
      <Dialog open={iosHelp} onOpenChange={setIosHelp}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Установка на iPhone</DialogTitle>
            <DialogDescription>Магазин будет открываться с экрана «Домой», как обычное приложение.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Share className="size-4" />
              </span>
              Нажмите «Поделиться» в панели Safari
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <SquarePlus className="size-4" />
              </span>
              Выберите «На экран “Домой”»
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Регистрирует service worker (только в продакшене — в dev он мешает горячей перезагрузке). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}

export function ReloadButton() {
  return (
    <Button size="lg" className="h-11 px-6" onClick={() => window.location.reload()}>
      <RotateCw /> Обновить
    </Button>
  );
}
