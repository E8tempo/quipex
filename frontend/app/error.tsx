"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="font-heading text-2xl font-bold">Что-то пошло не так</h1>
      <p className="max-w-md text-muted-foreground">Сервис временно недоступен. Попробуйте обновить страницу через минуту.</p>
      <Button onClick={reset} size="lg">Попробовать снова</Button>
    </div>
  );
}
