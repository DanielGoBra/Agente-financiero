import { handle } from "@astrojs/cloudflare/handler";
export { ProspectingWorkflow } from "./workflows/ProspectingWorkflow";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handle(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
