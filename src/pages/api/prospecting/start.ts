import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  authenticateRequest,
  consumeProspectingWorkflowRateLimit,
  getSupabasePublicConfig,
  isSameOriginRequest,
  jsonResponse,
  readBoundedJson,
} from "../../../lib/server/security";
import { normalizeBusiness, type BusinessInput } from "../validate-businesses";
import {
  PROSPECTING_BATCH_SIZE,
  type ProspectingWorkflowParams,
} from "../../../workflows/ProspectingWorkflow";

const MAX_REQUEST_BYTES = 768 * 1024;
const MAX_BUSINESSES = 200;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+([^\s]{20,4096})$/i.exec(request.headers.get("Authorization") || "");
  return match?.[1] || null;
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createRunWithUserSession(
  request: Request,
  input: {
    runId: string;
    territory: string;
    sector: string;
    businesses: BusinessInput[];
    workflowTokenHash: string;
  },
): Promise<Response> {
  const token = bearerToken(request);
  const { url, key } = getSupabasePublicConfig();
  if (!token || !url || !key) throw new Error("Supabase no está configurado para prospectar.");

  return fetch(new URL("/rest/v1/rpc/crm_create_prospecting_run", url), {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_run_id: input.runId,
      p_territory: input.territory,
      p_sector: input.sector,
      p_candidates: input.businesses,
      p_workflow_token_hash: input.workflowTokenHash,
      p_total_batches: Math.ceil(input.businesses.length / PROSPECTING_BATCH_SIZE),
    }),
    signal: AbortSignal.timeout(15_000),
  });
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Origen de solicitud no permitido." }, 403);
  }

  const user = await authenticateRequest(request);
  if (!user) return jsonResponse({ error: "Sesión inválida o expirada." }, 401);
  if (!await consumeProspectingWorkflowRateLimit(user.id)) {
    return jsonResponse(
      { error: "Ya iniciaste varias prospecciones. Espera un minuto antes de crear otra." },
      429,
      { "Retry-After": "60", "X-RateLimit-Source": "cloudflare-workflow" },
    );
  }

  const parsedBody = await readBoundedJson(request, MAX_REQUEST_BYTES);
  if ("error" in parsedBody) return jsonResponse({ error: parsedBody.error }, parsedBody.status);
  const payload = asRecord(parsedBody.value);
  if (!payload || !Array.isArray(payload.businesses)) {
    return jsonResponse({ error: "La lista de negocios no es válida." }, 400);
  }
  if (payload.businesses.length < 1 || payload.businesses.length > MAX_BUSINESSES) {
    return jsonResponse({ error: `La ejecución admite entre 1 y ${MAX_BUSINESSES} negocios.` }, 413);
  }

  const normalized = payload.businesses.map(normalizeBusiness);
  if (normalized.some((business) => business === null)) {
    return jsonResponse({ error: "Uno o más negocios contienen campos inválidos." }, 400);
  }

  const businesses = normalized.filter((business): business is BusinessInput => business !== null);
  const territory = typeof payload.territory === "string" ? payload.territory.trim().slice(0, 160) : "Zona consultada";
  const sector = typeof payload.sector === "string" ? payload.sector.trim().slice(0, 160) : "Prospección general";
  const workflow = env.CRM_PROSPECTING_WORKFLOW;
  if (!workflow) {
    return jsonResponse({ error: "El procesamiento durable aún no está habilitado.", code: "WORKFLOW_UNAVAILABLE" }, 503);
  }

  const runId = crypto.randomUUID();
  const workflowToken = randomToken();
  const workflowTokenHash = await sha256(workflowToken);

  try {
    const runResponse = await createRunWithUserSession(request, {
      runId,
      territory: territory || "Zona consultada",
      sector: sector || "Prospección general",
      businesses,
      workflowTokenHash,
    });
    if (!runResponse.ok) {
      console.error(JSON.stringify({ event: "prospecting_run_create_failed", status: runResponse.status, userId: user.id }));
      return jsonResponse({ error: "No se pudo crear la ejecución de prospección." }, 502);
    }

    const params: ProspectingWorkflowParams = { runId, userId: user.id, workflowToken, businesses };
    await workflow.create({
      id: runId,
      params,
      retention: { successRetention: "3 days", errorRetention: "3 days" },
    });

    console.log(JSON.stringify({ event: "prospecting_workflow_started", runId, userId: user.id, total: businesses.length }));
    return jsonResponse({
      runId,
      status: "queued",
      total: businesses.length,
      batchSize: PROSPECTING_BATCH_SIZE,
      totalBatches: Math.ceil(businesses.length / PROSPECTING_BATCH_SIZE),
    }, 202, { "Retry-After": "2" });
  } catch (error) {
    console.error(JSON.stringify({
      event: "prospecting_workflow_start_failed",
      runId,
      userId: user.id,
      message: error instanceof Error ? error.message : "unknown",
    }));
    return jsonResponse({ error: "No se pudo iniciar el procesamiento durable.", code: "WORKFLOW_START_FAILED" }, 503);
  }
};
