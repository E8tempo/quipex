"use client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function errorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string; loc?: string[] };
    const msg = (first.msg || fallback).replace(/^Value error, /, "");
    return msg;
  }
  return fallback;
}

// ---------- обновление сессии по refresh-токену ----------

const refreshing: Record<string, Promise<boolean> | undefined> = {};

/** Админка и /auth — сессия сотрудника; всё остальное — сессия клиента сайта. */
function authScope(path: string): string {
  return path.startsWith("/admin") || path.startsWith("/auth/") ? "/auth" : "/account/auth";
}

/** Один запрос обновления на все параллельные 401 (и на все вкладки — через cookie). */
export function refreshSession(scope: string): Promise<boolean> {
  if (!refreshing[scope]) {
    refreshing[scope] = fetch(`/api${scope}/refresh`, { method: "POST", credentials: "include" })
      // 409 — соседняя вкладка уже обновила токены, новые cookie уже у нас
      .then((r) => r.ok || r.status === 409)
      .catch(() => false)
      .finally(() => setTimeout(() => (refreshing[scope] = undefined), 0));
  }
  return refreshing[scope]!;
}

/** Запрос к API из браузера. Всегда относительный путь — домен берётся из адресной строки. */
export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const res = await rawRequest(path, init);
  if (res.status === 401 && !/\/auth\/(login|refresh|register|logout)/.test(path)) {
    // access-токен истёк — обновляем сессию и повторяем запрос один раз.
    // Если обновить не удалось, сервер уже стёр cookie, и публичный запрос пройдёт как анонимный.
    await refreshSession(authScope(path));
    return parse<T>(await rawRequest(path, init));
  }
  return parse<T>(res);
}

async function rawRequest(path: string, init?: RequestInit & { json?: unknown }): Promise<Response> {
  const { json, headers, ...rest } = init ?? {};
  return fetch(`/api${path}`, {
    credentials: "include",
    ...rest,
    headers: {
      accept: "application/json",
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(data?.detail, "Ошибка запроса"));
  }
  return data as T;
}

export const apiPost = <T = unknown>(path: string, json?: unknown) =>
  api<T>(path, { method: "POST", json });
export const apiPut = <T = unknown>(path: string, json?: unknown) =>
  api<T>(path, { method: "PUT", json });
export const apiPatch = <T = unknown>(path: string, json?: unknown) =>
  api<T>(path, { method: "PATCH", json });
export const apiDelete = <T = unknown>(path: string) => api<T>(path, { method: "DELETE" });

export async function apiUpload<T = unknown>(path: string, files: File[] | File, field = "file"): Promise<T> {
  const fd = new FormData();
  (Array.isArray(files) ? files : [files]).forEach((f) => fd.append(field, f));
  return api<T>(path, { method: "POST", body: fd });
}
