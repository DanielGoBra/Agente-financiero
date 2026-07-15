import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async () => {
  const openrouterKey = (env as any).OPENROUTER_API_KEY || '';
  
  const info: any = {
    keyPresent: !!openrouterKey,
    keyLength: openrouterKey.length,
    keyPrefix: openrouterKey ? openrouterKey.substring(0, 6) + '...' : 'N/A',
    model: (env as any).OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free (default)',
  };

  // Quick test call to OpenRouter to check auth
  if (openrouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { "Authorization": `Bearer ${openrouterKey}` }
      });
      info.authTest = {
        status: res.status,
        ok: res.ok,
        statusText: res.statusText
      };
      if (!res.ok) {
        info.authTest.body = await res.text();
      }
    } catch (e: any) {
      info.authTest = { error: e.message };
    }
  }

  return new Response(JSON.stringify(info, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
