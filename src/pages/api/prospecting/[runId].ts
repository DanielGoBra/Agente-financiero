import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  authenticateRequest,
  getSupabasePublicConfig,
  isSameOriginRequest,
  jsonResponse,
} from "../../../lib/server/security";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bearerToken(request: Request): string | null {
  return /^Bearer\s+([^\s]{20,4096})$/i.exec(request.headers.get("Authorization") || "")?.[1] || null;
}

async function supabaseGet(request: Request, path: string, search: Record<string, string>): Promise<Response> {
  const token = bearerToken(request);
  const { url, key } = getSupabasePublicConfig();
  if (!token || !url || !key) throw new Error("Supabase no está configurado.");
  const endpoint = new URL(path, url);
  Object.entries(search).forEach(([name, value]) => endpoint.searchParams.set(name, value));
  return fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
}

export const GET: APIRoute = async ({ request, params }) => {
  if (!isSameOriginRequest(request)) return jsonResponse({ error: "Origen de solicitud no permitido." }, 403);
  const user = await authenticateRequest(request);
  if (!user) return jsonResponse({ error: "Sesión inválida o expirada." }, 401);

  const runId = params.runId || "";
  if (!UUID.test(runId)) return jsonResponse({ error: "Identificador de ejecución inválido." }, 400);

  try {
    const [runResponse, candidatesResponse] = await Promise.all([
      supabaseGet(request, "/rest/v1/crm_prospecting_runs", {
        id: `eq.${runId}`,
        select: "id,status,total_candidates,enriched_count,failed_count,metadata,created_at,started_at,completed_at",
        limit: "1",
      }),
      supabaseGet(request, "/rest/v1/crm_prospecting_candidates", {
        run_id: `eq.${runId}`,
        select: "google_place_id,enrichment_status,analysis,last_error_code,last_error_message",
        order: "created_at.asc",
      }),
    ]);

    if (!runResponse.ok || !candidatesResponse.ok) {
      return jsonResponse({ error: "No se pudo consultar el progreso de la prospección." }, 502);
    }

    const runs = await runResponse.json() as Array<Record<string, unknown>>;
    if (runs.length === 0) return jsonResponse({ error: "Ejecución no encontrada." }, 404);
    const run = runs[0];
    const candidates = await candidatesResponse.json() as Array<Record<string, unknown>>;
    const metadata = typeof run.metadata === "object" && run.metadata !== null
      ? run.metadata as Record<string, unknown>
      : {};

    let workflowStatus = "unknown";
    try {
      const instance = await env.CRM_PROSPECTING_WORKFLOW.get(runId);
      workflowStatus = (await instance.status()).status;
    } catch {
      workflowStatus = "unknown";
    }

    return jsonResponse({
      runId,
      status: run.status,
      workflowStatus,
      total: run.total_candidates,
      enriched: run.enriched_count,
      failed: run.failed_count,
      completedBatches: Number(metadata.completed_batches || 0),
      totalBatches: Number(metadata.total_batches || 0),
      candidates: candidates.map((candidate) => {
        const analysis = typeof candidate.analysis === "object" && candidate.analysis !== null
          ? candidate.analysis as Record<string, unknown>
          : {};
        return {
          id: candidate.google_place_id,
          status: candidate.enrichment_status,
          business: analysis.business || null,
          validation: analysis.validation || null,
          errorCode: candidate.last_error_code || null,
          errorMessage: candidate.last_error_message || null,
        };
      }),
    }, 200, { "Retry-After": "2" });
  } catch (error) {
    console.error(JSON.stringify({
      event: "prospecting_status_failed",
      runId,
      userId: user.id,
      message: error instanceof Error ? error.message : "unknown",
    }));
    return jsonResponse({ error: "No se pudo consultar la ejecución durable." }, 500);
  }
};
