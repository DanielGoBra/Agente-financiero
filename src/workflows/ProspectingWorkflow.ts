import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import type { BusinessInput } from "../pages/api/validate-businesses";
import {
  AIProviderError,
  analyzeBusinessBatch,
  resolveFreeOpenRouterModels,
} from "../lib/server/openRouterValidation";
import { recordProspectingBatch } from "../lib/server/workflowSupabase";

export interface ProspectingWorkflowParams {
  runId: string;
  userId: string;
  workflowToken: string;
  businesses: BusinessInput[];
}

interface PersistedBatchResult {
  validations: Awaited<ReturnType<typeof analyzeBusinessBatch>>["validations"];
  model: string;
}

export const PROSPECTING_BATCH_SIZE = 4;

export class ProspectingWorkflow extends WorkflowEntrypoint<Cloudflare.Env, ProspectingWorkflowParams> {
  async run(event: WorkflowEvent<ProspectingWorkflowParams>, step: WorkflowStep) {
    const { runId, workflowToken, businesses } = event.payload;
    const models = resolveFreeOpenRouterModels(this.env.OPENROUTER_MODEL || "");
    let enriched = 0;
    let failed = 0;

    const totalBatches = Math.ceil(businesses.length / PROSPECTING_BATCH_SIZE);

    for (let offset = 0; offset < businesses.length; offset += PROSPECTING_BATCH_SIZE) {
      const batchNumber = Math.floor(offset / PROSPECTING_BATCH_SIZE) + 1;
      const batch = businesses.slice(offset, offset + PROSPECTING_BATCH_SIZE);
      let batchResult: PersistedBatchResult | null = null;
      let failureMessage = "El proveedor de IA agotó sus reintentos.";

      console.log(JSON.stringify({
        event: "prospecting_batch_started",
        runId,
        batchNumber,
        totalBatches,
        businesses: batch.length,
      }));

      try {
        batchResult = await step.do(
          `analyze-batch-${batchNumber}`,
          {
            retries: {
              limit: 1,
              delay: "5 seconds",
              backoff: "constant",
            },
            timeout: "80 seconds",
          },
          async () => {
            try {
              return await analyzeBusinessBatch(batch, {
                apiKey: this.env.OPENROUTER_API_KEY,
                models,
                referer: this.env.APP_URL,
                onModelAttempt: ({ model, attempt, remaining }) => {
                  console.log(JSON.stringify({
                    event: "prospecting_model_attempt",
                    runId,
                    batchNumber,
                    totalBatches,
                    model,
                    attempt,
                    remaining,
                  }));
                },
              });
            } catch (error) {
              if (error instanceof AIProviderError && !error.retryable) {
                throw new NonRetryableError(error.message);
              }
              throw error;
            }
          },
        );
      } catch (error) {
        failureMessage = error instanceof Error ? error.message : failureMessage;
      }

      const validatedIds = new Set(batchResult?.validations.map((validation) => validation.id) || []);
      const failedIds = batch
        .map((business) => business.id)
        .filter((id) => !validatedIds.has(id));

      await step.do(
        `persist-batch-${batchNumber}`,
        {
          retries: { limit: 8, delay: "5 seconds", backoff: "exponential" },
          timeout: "1 minute",
        },
        async () => {
          await recordProspectingBatch(this.env, {
            runId,
            workflowToken,
            batchKey: `batch-${batchNumber}`,
            results: batchResult?.validations || [],
            failedIds,
            modelId: batchResult?.model,
            promptVersion: "v3",
            errorCode: failedIds.length > 0 ? "AI_BATCH_FAILED" : undefined,
            errorMessage: failedIds.length > 0 ? failureMessage : undefined,
          });
          return { enriched: validatedIds.size, failed: failedIds.length };
        },
      );

      enriched += validatedIds.size;
      failed += failedIds.length;

      console.log(JSON.stringify({
        event: "prospecting_batch_completed",
        runId,
        batchNumber,
        totalBatches,
        enriched: validatedIds.size,
        failed: failedIds.length,
      }));
    }

    await step.do(
      "finalize-run",
      {
        retries: { limit: 8, delay: "5 seconds", backoff: "exponential" },
        timeout: "1 minute",
      },
      async () => {
        await recordProspectingBatch(this.env, {
          runId,
          workflowToken,
          isFinal: true,
        });
        return { status: failed === 0 ? "completed" : "partial" };
      },
    );

    console.log(JSON.stringify({
      event: "prospecting_workflow_completed",
      runId,
      userId: event.payload.userId,
      total: businesses.length,
      enriched,
      failed,
    }));

    return { runId, total: businesses.length, enriched, failed };
  }
}
