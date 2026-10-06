"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Ellipsis, RotateCw, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Событие установки может прийти до монтирования React — держим его в модуле.
let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
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
    installed = true;
    emit();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

type InstallMode = "prompt" | "ios" | null;

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function getMode(): InstallMode {
  if (installed || isStandalone()) return null;
  if (deferred) return "prompt";
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  return isIOS ? "ios" : null;
}

/** Можно ли предложить установку: Android/Chrome — системный диалог, iOS — инструкция. */
export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, getMode, () => null);
}

/** Показывает системный диалог установки (Android, Chrome, Edge). */
async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  emit();
  return outcome === "accepted";
}

/** Пошаговая инструкция для iPhone / iPad. */
export function IosInstallSteps({ className }: { className?: string }) {
  const steps = [
    {
      icon: Share,
      text: (
        <>
          Нажмите <b className="font-medium">«Поделиться»</b> в панели Safari
          <span className="block text-xs text-muted-foreground">
            Если кнопки не видно — нажмите <Ellipsis className="inline size-3.5 align-[-2px]" /> в адресной строке
          </span>
        </>
      ),
    },
    {
      icon: SquarePlus,
      text: (
        <>
          Выберите <b className="font-medium">«На экран „Домой“»</b>
          <span className="block text-xs text-muted-foreground">Пункт может быть ниже — прокрутите список</span>
        </>
      ),
    },
    { icon: null, text: <>Нажмите <b className="font-medium">«Добавить»</b> — иконка появится на экране</> },
  ];
  return (
    <ol className={cn("space-y-3 text-sm", className)}>
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
            {s.icon ? <s.icon className="size-4" /> : i + 1}
          </span>
          <span className="pt-1.5 leading-snug">{s.text}</span>
        </li>
      ))}
    </ol>
  );
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
        onClick={() => (mode === "ios" ? setIosHelp(true) : promptInstall())}
      >
        <Download className="size-4" /> Установить приложение
      </Button>
      <Dialog open={iosHelp} onOpenChange={setIosHelp}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Установка на iPhone</DialogTitle>
            <DialogDescription>Магазин будет открываться с экрана «Домой», как обычное приложение.</DialogDescription>
          </DialogHeader>
          <IosInstallSteps />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- ненавязчивое окно с предложением установки ----------

const DISMISS_KEY = "quipex-install-dismissed";
const VISITS_KEY = "quipex-visits";
const DISMISS_DAYS = 14;
const SHOW_DELAY_MS = 12_000;
// не мешаем там, где человек занят делом
const HIDDEN_ON = ["/checkout", "/cart", "/login", "/register", "/order", "/offline"];

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function recentlyDismissed(): boolean {
  const at = Number(storage()?.getItem(DISMISS_KEY) || 0);
  return Date.now() - at < DISMISS_DAYS * 86_400_000;
}

export function InstallPrompt({ siteName }: { siteName: string }) {
  const mode = useInstallMode();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    if (!mode || recentlyDismissed()) return;
    const store = storage();
    const visits = Number(store?.getItem(VISITS_KEY) || 0) + 1;
    store?.setItem(VISITS_KEY, String(visits));
    // повторный визит — показываем быстрее, первый — даём осмотреться
    const t = setTimeout(() => setVisible(true), visits > 1 ? 3_000 : SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [mode]);

  const dismiss = () => {
    storage()?.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!mode || !visible || HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <div
      role="dialog"
      aria-label="Установка приложения"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-sm rounded-3xl border bg-background/95 p-4 shadow-2xl shadow-black/15 backdrop-blur animate-in fade-in slide-in-from-bottom-4 duration-300 sm:right-6 sm:bottom-6 sm:left-auto sm:mx-0"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <button onClick={dismiss} className="absolute top-3 right-3 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Закрыть">
        <X className="size-4" />
      </button>
      <div className="flex items-center gap-3 pr-8">
        <img src="/icons/icon-192.png" alt="" className="size-12 shrink-0 rounded-[0.9rem] shadow-sm" />
        <div className="min-w-0">
          <p className="font-medium leading-tight">Приложение {siteName}</p>
          <p className="mt-0.5 text-sm leading-snug text-muted-foreground">Каталог и заказы — в одно касание с экрана телефона</p>
        </div>
      </div>

      {mode === "ios" && showSteps ? <IosInstallSteps className="mt-4 border-t pt-4" /> : null}

      <div className="mt-4 flex gap-2">
        {mode === "prompt" ? (
          <Button
            className="h-10 flex-1"
            onClick={async () => {
              const ok = await promptInstall();
              if (!ok) dismiss();
            }}
          >
            <Download /> Установить
          </Button>
        ) : showSteps ? (
          <Button className="h-10 flex-1" onClick={dismiss}>
            Понятно
          </Button>
        ) : (
          <Button className="h-10 flex-1" onClick={() => setShowSteps(true)}>
            Как установить
          </Button>
        )}
        {!(mode === "ios" && showSteps) ? (
          <Button variant="ghost" className="h-10 px-4 text-muted-foreground" onClick={dismiss}>
            Не сейчас
          </Button>
        ) : null}
      </div>
    </div>
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
