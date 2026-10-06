"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleDollarSign, Loader2, Play, RefreshCw, Square, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loading, PageHeader, Panel, Pill, useApi } from "@/components/admin/ui";
import { useAdmin } from "@/components/admin/shell";
import { api, apiPost } from "@/lib/api-client";
import { dateTime } from "@/lib/format";
import type { ImportJob } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<ImportJob["status"], { label: string; tone: string }> = {
  pending: { label: "В очереди", tone: "bg-muted text-muted-foreground" },
  running: { label: "Выполняется", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  success: { label: "Успешно", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  failed: { label: "Ошибка", tone: "bg-destructive/15 text-destructive" },
  cancelled: { label: "Остановлен", tone: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400" },
};

const STAT_LABELS: Record<string, string> = {
  categories_created: "Новых категорий",
  products_created: "Новых товаров",
  products_updated: "Обновлено",
  products_deactivated: "Снято с публикации",
  images_downloaded: "Скачано фото",
  errors: "Ошибок",
};

function JobView({ job }: { job: ImportJob }) {
  const logRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [job.log]);
  const pct = job.total ? Math.round((job.progress / job.total) * 100) : 0;
  const active = job.status === "running" || job.status === "pending";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone={STATUS[job.status].tone}>{STATUS[job.status].label}</Pill>
        <span className="text-sm text-muted-foreground">
          #{job.id} · {job.mode === "full" ? "полный импорт" : "цены и наличие"} · {job.trigger === "schedule" ? "по расписанию" : "вручную"} · {dateTime(job.started_at ?? job.created_at)}
        </span>
      </div>
      {job.total ? (
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span>
              {job.progress} из {job.total}
            </span>
            <span className="font-semibold">{pct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full bg-primary transition-all duration-500", active && "animate-pulse")} style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : active ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Сбор структуры каталога…
        </p>
      ) : null}
      {job.stats ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(STAT_LABELS).map(([k, label]) => (
            <div key={k} className="rounded-xl bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn("font-heading text-xl font-bold", k === "errors" && (job.stats?.[k] ?? 0) > 0 && "text-destructive")}>{job.stats?.[k] ?? 0}</p>
            </div>
          ))}
        </div>
      ) : null}
      {job.error ? <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{job.error}</p> : null}
      {job.log ? (
        <pre ref={logRef} className="max-h-72 overflow-auto rounded-xl bg-navy p-4 font-mono text-xs leading-relaxed text-navy-foreground/85">
          {job.log}
        </pre>
      ) : null}
    </div>
  );
}

export default function ImportPage() {
  const { refreshCounters } = useAdmin();
  const { data: jobs, setData: setJobs, loading, reload } = useApi<ImportJob[]>("/admin/import/jobs");
  const [images, setImages] = useState(true);
  const [starting, setStarting] = useState(false);
  const current = jobs?.[0];
  const running = current && (current.status === "running" || current.status === "pending");

  useEffect(() => {
    if (!running || !current) return;
    const t = setInterval(async () => {
      try {
        const j = await api<ImportJob>(`/admin/import/jobs/${current.id}`);
        setJobs((js) => (js ? [j, ...js.slice(1)] : [j]));
        if (j.status !== "running" && j.status !== "pending") {
          refreshCounters();
          if (j.status === "success") toast.success("Импорт завершён");
          else if (j.status === "failed") toast.error("Импорт завершился с ошибкой");
        }
      } catch {}
    }, 2000);
    return () => clearInterval(t);
  }, [running, current, setJobs, refreshCounters]);

  const start = async (mode: "full" | "prices") => {
    setStarting(true);
    try {
      await apiPost("/admin/import/start", { mode, download_images: images });
      toast.success("Импорт запущен");
      reload();
      refreshCounters();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Импорт с e8.ru" description="Синхронизация каталога, цен, наличия, фото и характеристик с сайта-источника" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
          <div className="flex gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <RefreshCw className="size-5" />
            </span>
            <div>
              <p className="font-semibold">Полная синхронизация</p>
              <p className="text-sm text-muted-foreground">
                Категории, новые товары, описания, характеристики, фото, цены и наличие. Товары, пропавшие с источника, снимаются с публикации.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={images} onCheckedChange={setImages} /> Скачивать фотографии на сервер
          </label>
          <Button className="mt-auto" onClick={() => start("full")} disabled={!!running || starting}>
            <Play /> Запустить
          </Button>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
          <div className="flex gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <CircleDollarSign className="size-5" />
            </span>
            <div>
              <p className="font-semibold">Только цены и наличие</p>
              <p className="text-sm text-muted-foreground">
                Быстрое обновление уже импортированных товаров. Закреплённые вручную цены не меняются. Наценка задаётся в «Настройках».
              </p>
            </div>
          </div>
          <Button variant="outline" className="mt-auto" onClick={() => start("prices")} disabled={!!running || starting}>
            <Play /> Обновить цены
          </Button>
        </div>
      </div>

      {loading && !jobs ? (
        <Loading />
      ) : current ? (
        <Panel
          title="Текущий / последний запуск"
          actions={
            running ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await apiPost(`/admin/import/jobs/${current.id}/cancel`);
                  toast("Остановка после текущей партии…");
                }}
              >
                <Square /> Остановить
              </Button>
            ) : null
          }
        >
          <JobView job={current} />
        </Panel>
      ) : (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Импорт ещё не запускался</div>
      )}

      {jobs && jobs.length > 1 ? (
        <Panel title="История">
          <ul className="-my-2 divide-y text-sm">
            {jobs.slice(1).map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-3 py-2.5">
                {j.status === "success" ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-muted-foreground" />}
                <span className="font-medium">#{j.id}</span>
                <span className="text-muted-foreground">{dateTime(j.started_at ?? j.created_at)}</span>
                <span>{j.mode === "full" ? "полный" : "цены"}</span>
                <Pill tone={STATUS[j.status].tone}>{STATUS[j.status].label}</Pill>
                {j.stats ? (
                  <span className="ml-auto text-xs text-muted-foreground">
                    +{j.stats.products_created ?? 0} / ~{j.stats.products_updated ?? 0} / ошибок {j.stats.errors ?? 0}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
