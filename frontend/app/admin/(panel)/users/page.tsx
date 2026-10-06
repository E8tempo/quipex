"use client";

import { useState } from "react";
import { KeyRound, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Confirm, ErrorBox, Field, Loading, PageHeader, Pill, useApi } from "@/components/admin/ui";
import { useAdmin } from "@/components/admin/shell";
import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";
import { dateTime } from "@/lib/format";
import type { User } from "@/lib/types";

function UserDialog({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.full_name ?? "");
  const [password, setPassword] = useState("");
  const [superuser, setSuperuser] = useState(user?.is_superuser ?? false);
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? "Изменить пользователя" : "Новый пользователь"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {!user ? (
            <Field label="Email *">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          ) : null}
          <Field label="Имя">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={user ? "Новый пароль" : "Пароль *"} hint="Минимум 8 символов">
            <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <label className="flex items-center justify-between text-sm">
            <span>
              <span className="font-medium">Суперпользователь</span>
              <span className="block text-xs text-muted-foreground">Может менять настройки и управлять пользователями</span>
            </span>
            <Switch checked={superuser} onCheckedChange={setSuperuser} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                if (user) await apiPatch(`/admin/users/${user.id}`, { full_name: name || null, is_superuser: superuser, ...(password ? { password } : {}) });
                else await apiPost("/admin/users", { email, password, full_name: name || null, is_superuser: superuser });
                toast.success("Сохранено");
                onSaved();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Ошибка");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="animate-spin" /> : null} Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { user: me } = useAdmin();
  const { data, loading, error, reload } = useApi<User[]>(me.is_superuser ? "/admin/users" : null);
  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  if (!me.is_superuser) return <ErrorBox message="Раздел доступен только суперпользователю" />;
  if (error) return <ErrorBox message={error} />;
  return (
    <div>
      <PageHeader
        title="Пользователи"
        description="Сотрудники с доступом к админ-панели"
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus /> Добавить
          </Button>
        }
      />
      {loading && !data ? (
        <Loading />
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          {data?.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {u.full_name || u.email} {u.id === me.id ? <span className="text-xs text-muted-foreground">(вы)</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {u.email} · последний вход {dateTime(u.last_login_at)}
                </p>
              </div>
              {u.is_superuser ? (
                <Pill tone="bg-primary/15 text-primary">
                  <ShieldCheck className="mr-1 size-3" /> Суперпользователь
                </Pill>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Активен
                <Switch
                  checked={u.is_active}
                  disabled={u.id === me.id}
                  onCheckedChange={async (v) => {
                    try {
                      await apiPatch(`/admin/users/${u.id}`, { is_active: v });
                      reload();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Ошибка");
                    }
                  }}
                />
              </label>
              <Button variant="ghost" size="icon" onClick={() => setEditing(u)} aria-label="Изменить">
                <KeyRound />
              </Button>
              {u.id !== me.id ? (
                <Confirm
                  title={`Удалить ${u.email}?`}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label="Удалить">
                      <Trash2 />
                    </Button>
                  }
                  onConfirm={async () => {
                    await apiDelete(`/admin/users/${u.id}`);
                    reload();
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
      {editing !== undefined ? (
        <UserDialog
          user={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
