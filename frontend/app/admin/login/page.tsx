"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoMark } from "@/components/common/logo";
import { apiPost } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <form
        className="w-full max-w-sm space-y-5 rounded-3xl border bg-card p-8 shadow-xl"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          try {
            await apiPost("/auth/login", { email, password });
            const next = new URLSearchParams(window.location.search).get("next");
            router.replace(next && next.startsWith("/admin") ? next : "/admin");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Ошибка входа");
            setLoading(false);
          }
        }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoMark className="size-12" />
          <h1 className="font-heading text-2xl font-extrabold">Вход в админ-панель</h1>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Пароль</Label>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : null} Войти
        </Button>
      </form>
    </div>
  );
}
