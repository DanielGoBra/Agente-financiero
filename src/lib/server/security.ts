import { env } from "cloudflare:workers";

type AdditionalRuntimeEnv = Partial<{
  PUBLIC_SUPABASE_URL: string;
  PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_ANON_KEY: string;
  OPENROUTER_MODELS: string;
}>;

type RuntimeEnv = Cloudflare.Env & AdditionalRuntimeEnv;
type StringEnvKey = Exclude<{
  [Key in keyof RuntimeEnv]: RuntimeEnv[Key] extends string | undefined ? Key : never;
}[keyof RuntimeEnv], undefined>;

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

const runtimeEnv = env as RuntimeEnv;

export function getRuntimeString(key: StringEnvKey): string {
  const value = runtimeEnv[key];
  return typeof value === "string" ? value.trim() : "";
}

export function getSupabasePublicConfig(): { url: string; key: string } {
  const url = getRuntimeString("PUBLIC_SUPABASE_URL") || getRuntimeString("SUPABASE_URL");
  const key = getRuntimeString("PUBLIC_SUPABASE_ANON_KEY")
    || getRuntimeString("SUPABASE_ANON_KEY")
    || getRuntimeString("SUPABASE_KEY");

  return { url, key };
}

export function isBrowserSafeSupabaseKey(key: string): boolean {
  if (key.startsWith("sb_publishable_")) return true;
  if (!key.startsWith("eyJ")) return false;

  try {
    const payload = key.split(".")[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const claims = JSON.parse(atob(padded)) as { role?: unknown };
    return claims.role === "anon";
  } catch {
    return false;
  }
}

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(JSON.stringify(body), { status, headers });
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;

  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readBoundedJson(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; status: number; error: string }> {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return { ok: false, status: 415, error: "El contenido debe enviarse como JSON." };
  }

  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, status: 413, error: "La solicitud excede el tamaño permitido." };
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    return { ok: false, status: 413, error: "La solicitud excede el tamaño permitido." };
  }

  try {
    return { ok: true, value: JSON.parse(body) as unknown };
  } catch {
    return { ok: false, status: 400, error: "El cuerpo JSON no es válido." };
  }
}

export async function authenticateRequest(request: Request): Promise<AuthenticatedUser | null> {
  const authorization = request.headers.get("Authorization") || "";
  const match = /^Bearer\s+([^\s]{20,4096})$/i.exec(authorization);
  if (!match) return null;

  const { url, key } = getSupabasePublicConfig();
  if (!url || !key || !isBrowserSafeSupabaseKey(key)) return null;

  let authUrl: URL;
  try {
    authUrl = new URL("/auth/v1/user", url);
  } catch {
    return null;
  }

  try {
    const response = await fetch(authUrl, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${match[1]}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) return null;

    const payload = await response.json() as { id?: unknown; email?: unknown };
    if (typeof payload.id !== "string" || payload.id.length < 10) return null;

    return {
      id: payload.id,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}

export async function consumeApiRateLimit(userId: string): Promise<boolean> {
  const limiter = runtimeEnv.API_RATE_LIMITER;
  if (!limiter) return true;

  try {
    const result = await limiter.limit({ key: `validate-businesses:${userId}` });
    return result.success;
  } catch (error) {
    console.error(JSON.stringify({
      event: "rate_limit_error",
      message: error instanceof Error ? error.message : "unknown",
    }));
    return false;
  }
}
