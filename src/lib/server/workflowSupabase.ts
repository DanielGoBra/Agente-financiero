interface WorkflowSupabaseEnv {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
}

export async function recordProspectingBatch(
  env: WorkflowSupabaseEnv,
  payload: {
    runId: string;
    workflowToken: string;
    batchKey?: string;
    results?: unknown[];
    failedIds?: string[];
    modelId?: string;
    promptVersion?: string;
    errorCode?: string;
    errorMessage?: string;
    isFinal?: boolean;
  },
): Promise<void> {
  const endpoint = new URL("/rest/v1/rpc/crm_record_prospecting_batch", env.SUPABASE_URL);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_KEY,
      Authorization: `Bearer ${env.SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_run_id: payload.runId,
      p_workflow_token: payload.workflowToken,
      p_batch_key: payload.batchKey || null,
      p_results: payload.results || [],
      p_failed_ids: payload.failedIds || [],
      p_model_id: payload.modelId || null,
      p_prompt_version: payload.promptVersion || "v3",
      p_error_code: payload.errorCode || null,
      p_error_message: payload.errorMessage || null,
      p_is_final: Boolean(payload.isFinal),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Supabase rechazó el progreso del Workflow (${response.status}).`);
  }
}
