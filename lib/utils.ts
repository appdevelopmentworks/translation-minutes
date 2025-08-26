// lightweight cn (no external deps)
type ClassValue = string | number | null | undefined | Record<string, boolean> | ClassValue[];

export function cn(...classes: Array<ClassValue>) {
  return classes
    .flatMap((c) =>
      typeof c === "string"
        ? c
        : Array.isArray(c)
        ? c
        : typeof c === "object" && c
        ? Object.entries(c)
            .filter(([, v]) => !!v)
            .map(([k]) => k)
        : []
    )
    .filter(Boolean)
    .join(" ");
}

export async function fetchJsonWithRetry<T = any>(
  url: string,
  init: RequestInit,
  retries = 2,
  backoffMs = 500
): Promise<{ ok: boolean; status: number; json: T }>
{
  let lastErr: any;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, status: res.status, json: data as T };
      lastErr = new Error((data as any)?.detail || (data as any)?.error || `HTTP ${res.status}`);
    } catch (e: any) {
      lastErr = e;
    }
    if (i < retries) await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, i)));
  }
  throw lastErr;
}
