import { connection } from "next/server";

const API = (process.env.API_INTERNAL_URL || "http://localhost:8000").replace(/\/$/, "");
const REVALIDATE = Number(process.env.API_CACHE_SECONDS ?? 30);

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null | string[]>;

export function buildQuery(params?: Query): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Запрос к бэкенду из серверных компонентов. Данные кешируются на REVALIDATE секунд. */
export async function apiGet<T>(path: string, params?: Query, opts?: { revalidate?: number }): Promise<T> {
  await connection();
  const res = await fetch(`${API}/api${path}${buildQuery(params)}`, {
    next: { revalidate: opts?.revalidate ?? REVALIDATE },
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).detail ?? msg;
    } catch {}
    throw new ApiError(res.status, typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return res.json() as Promise<T>;
}

/** То же, но 404 превращается в null. */
export async function apiGetOrNull<T>(path: string, params?: Query): Promise<T | null> {
  try {
    return await apiGet<T>(path, params);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}
